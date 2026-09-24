/**
 * Серверная проверка состава заявки и пересчёт стоимости.
 *
 * Это главный рубеж безопасности приложения. Клиент присылает только
 * идентификаторы и количество; всё остальное — цены, наличие, правила выбора,
 * допустимый вес — берётся из базы прямо здесь. Даже если фронтенд переписан
 * через консоль браузера, подделать сумму не выйдет: она вычисляется заново.
 *
 * Заодно ловятся не только злоупотребления, но и честные гонки: пока клиент
 * собирал торт, Ксения могла погасить тумблер наличия у выбранной начинки.
 */

import type { Firestore } from 'firebase-admin/firestore';
import type { DessertCategory, DessertComponent } from '../../src/types/index.js';

export interface VerifiedOrder {
  category: DessertCategory;
  /** Выбранные компоненты в порядке шагов категории. */
  components: DessertComponent[];
  /** Состав в человекочитаемом виде: «Начинка» → «Чёрный лес». */
  details: Array<{ label: string; value: string }>;
  quantity: number;
  /** Итоговая сумма, посчитанная на сервере. */
  total: number;
}

export class OrderValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrderValidationError';
  }
}

/** Количество должно попадать в правило категории, а не быть любым числом. */
function assertQuantityAllowed(category: DessertCategory, quantity: number): void {
  const rule = category.quantity;

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new OrderValidationError('Некорректное количество');
  }

  if (rule.isFixed) {
    if (quantity !== rule.defaultValue) {
      throw new OrderValidationError('Для этой позиции количество фиксированное');
    }
    return;
  }

  if (rule.presets?.length) {
    if (!rule.presets.includes(quantity)) {
      throw new OrderValidationError('Такого варианта количества нет');
    }
    return;
  }

  const { min, max, step } = rule;
  if (min === undefined || max === undefined || !step) {
    throw new OrderValidationError('У категории не задано правило количества');
  }

  if (quantity < min || quantity > max) {
    throw new OrderValidationError(`Допустимо от ${min} до ${max} ${rule.unitLabel}`);
  }

  // Проверяем кратность шагу через целые числа: 1.5 + 0.5 в двоичной
  // арифметике даёт не ровно 2, и прямое сравнение остатка было бы ложным.
  const stepsFromMin = Math.round((quantity - min) / step);
  if (Math.abs(min + stepsFromMin * step - quantity) > 1e-6) {
    throw new OrderValidationError(`Количество должно быть кратно ${step} ${rule.unitLabel}`);
  }
}

export async function verifyAndPrice(
  db: Firestore,
  categoryId: string,
  componentIds: string[],
  quantity: number,
): Promise<VerifiedOrder> {
  const categorySnapshot = await db.collection('categories').doc(categoryId).get();
  if (!categorySnapshot.exists) {
    throw new OrderValidationError('Такой категории десертов не существует');
  }

  const category = categorySnapshot.data() as DessertCategory;
  if (!category.isActive) {
    throw new OrderValidationError('Приём заказов по этой категории сейчас закрыт');
  }

  assertQuantityAllowed(category, quantity);

  const uniqueIds = [...new Set(componentIds)];
  if (uniqueIds.length === 0) {
    throw new OrderValidationError('Не выбрано ни одного ингредиента');
  }
  if (uniqueIds.length > 20) {
    // Защита от запроса, раздувающего чтение базы.
    throw new OrderValidationError('Слишком много ингредиентов в заявке');
  }

  const documents = await db.getAll(
    ...uniqueIds.map((id) => db.collection('components').doc(id)),
  );

  const components: DessertComponent[] = [];
  for (const [index, document] of documents.entries()) {
    if (!document.exists) {
      throw new OrderValidationError(`Ингредиент «${uniqueIds[index]}» больше не доступен`);
    }

    const component = document.data() as DessertComponent;

    if (component.categoryId !== categoryId) {
      throw new OrderValidationError(`«${component.name}» не относится к выбранной категории`);
    }
    if (!component.inStock) {
      throw new OrderValidationError(
        `«${component.name}» только что закончился на кухне. Пожалуйста, выберите другой вариант`,
      );
    }
    if (component.needsPriceReview) {
      throw new OrderValidationError(`Цена на «${component.name}» уточняется`);
    }

    components.push(component);
  }

  // Проверяем правила каждого шага: сколько вариантов можно и нужно выбрать.
  const details: VerifiedOrder['details'] = [];
  for (const step of category.steps) {
    const chosen = components.filter((component) => component.type === step.type);

    if (chosen.length < step.minSelect) {
      throw new OrderValidationError(
        `На шаге «${step.label}» нужно выбрать ${step.minSelect}, а выбрано ${chosen.length}`,
      );
    }
    if (chosen.length > step.maxSelect) {
      throw new OrderValidationError(
        `На шаге «${step.label}» можно выбрать не больше ${step.maxSelect}`,
      );
    }

    if (chosen.length > 0) {
      details.push({
        label: step.label,
        value: chosen.map((component) => component.name).join(', '),
      });
    }
  }

  // Компонент, не относящийся ни к одному шагу категории, — признак подделки.
  const knownTypes = new Set(category.steps.map((step) => step.type));
  const stray = components.find((component) => !knownTypes.has(component.type));
  if (stray) {
    throw new OrderValidationError(`«${stray.name}» нельзя добавить к этой категории`);
  }

  // Цену несёт вариант; остальные шаги дают доплаты.
  const variant = components.find((component) => component.type === 'variant');
  if (!variant) {
    throw new OrderValidationError('Не выбрана начинка');
  }

  const additions = components
    .filter((component) => component.type !== 'variant' && component.price > 0)
    .reduce((sum, component) => sum + component.price, 0);

  const total = Math.round(variant.price * quantity + additions);

  return { category, components, details, quantity, total };
}
