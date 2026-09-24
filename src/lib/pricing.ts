/**
 * Расчёт стоимости десерта.
 *
 * Единая формула для всех категорий:
 *
 *      итог = цена за единицу × количество + сумма доплат
 *
 * Цену за единицу несёт выбранный вариант (начинка или вкус):
 *   • торты  — 2500 ₽ за килограмм, количество = вес;
 *   • бенто  — 1500 ₽ за штуку, количество зафиксировано на единице;
 *   • моти   — 170 ₽ за штуку, количество = число штук;
 *   • наборы — цена за набор, количество = число наборов.
 *
 * ВАЖНО: этот расчёт живёт на клиенте и нужен только для мгновенного отклика
 * в интерфейсе. Пользователь может подменить результат через консоль браузера,
 * поэтому бэкенд обязан пересчитать сумму сам (см. ASSUMPTIONS.md).
 */

import type { ConstructorState, StepType } from '@/types';

/**
 * Подписи шагов по умолчанию.
 * Категория может задать свою через ConstructorStep.label — она приоритетнее.
 */
export const STEP_LABELS: Record<StepType, string> = {
  variant: 'Начинка',
  dough: 'Тесто',
  topping: 'Обсыпка',
  flavor: 'Вкусы',
  decor: 'Декор',
};

export interface PriceBreakdown {
  /** Цена за единицу, взятая у выбранного варианта. */
  unitPrice: number;
  /** Вес в килограммах либо количество штук или наборов. */
  quantity: number;
  /** Произведение цены за единицу на количество. */
  base: number;
  /** Доплаты за опции — только те, что стоят дороже нуля. */
  additions: Array<{ name: string; price: number }>;
  /** Итоговая сумма. */
  total: number;
  /** Расчёт полон: выбраны все обязательные шаги и задано количество. */
  isComplete: boolean;
}

const EMPTY_BREAKDOWN: PriceBreakdown = {
  unitPrice: 0,
  quantity: 0,
  base: 0,
  additions: [],
  total: 0,
  isComplete: false,
};

/**
 * Считает стоимость текущей сборки.
 * Возвращает нулевой результат, пока не выбраны категория, вариант и количество —
 * интерфейс в этом состоянии показывает прочерк вместо суммы.
 */
export function calculatePrice(state: ConstructorState): PriceBreakdown {
  const { category, selection, quantity } = state;

  if (!category || quantity === null || quantity <= 0) return EMPTY_BREAKDOWN;

  // Цену несёт вариант. Без него считать нечего.
  const variant = selection.variant?.[0];
  if (!variant) return EMPTY_BREAKDOWN;

  const unitPrice = variant.price;
  const base = roundRubles(unitPrice * quantity);

  // Доплаты берутся со всех шагов, кроме варианта: его цена уже учтена.
  const additions: Array<{ name: string; price: number }> = [];
  for (const [step, components] of Object.entries(selection)) {
    if (step === 'variant' || !components) continue;
    for (const component of components) {
      if (component.price <= 0) continue;
      additions.push({ name: component.name, price: component.price });
    }
  }

  const additionsTotal = additions.reduce((sum, addition) => sum + addition.price, 0);

  // Шаг пройден, когда выбрано не меньше минимума. Необязательные шаги
  // объявляют minSelect равным нулю и проверку проходят всегда.
  const isComplete = category.steps.every(
    (step) => (selection[step.type]?.length ?? 0) >= step.minSelect,
  );

  return {
    unitPrice,
    quantity,
    base,
    additions,
    total: roundRubles(base + additionsTotal),
    isComplete,
  };
}

/**
 * Округление до целых рублей.
 * Нужно из-за дробного веса: 2500 ₽/кг × 1.5 кг даёт ровно 3750, но
 * 2500 × 0.3 в двоичной арифметике даст 750.0000000000001.
 */
function roundRubles(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Форматирование суммы: 4500 → «4 500 ₽». Неразрывный пробел, чтобы не рвалось. */
export function formatPrice(value: number): string {
  return `${value.toLocaleString('ru-RU')} ₽`;
}

/**
 * Подпись количества с правильным склонением:
 * 1.5 кг · 1 штука · 4 штуки · 9 штук · 2 набора.
 */
export function formatQuantity(quantity: number, unitLabel: string): string {
  if (unitLabel === 'кг') {
    // Дробный вес показываем как «1,5 кг», целый — как «2 кг»
    return `${quantity.toLocaleString('ru-RU')} кг`;
  }

  const forms: Record<string, [string, string, string]> = {
    шт: ['штука', 'штуки', 'штук'],
    набор: ['набор', 'набора', 'наборов'],
  };

  const form = forms[unitLabel];
  if (!form) return `${quantity} ${unitLabel}`;

  return `${quantity} ${pluralize(quantity, form)}`;
}

/** Русское склонение по числу: 1 штука, 2 штуки, 5 штук. */
function pluralize(count: number, forms: [string, string, string]): string {
  const absolute = Math.abs(count) % 100;
  const remainder = absolute % 10;

  if (absolute > 10 && absolute < 20) return forms[2];
  if (remainder > 1 && remainder < 5) return forms[1];
  if (remainder === 1) return forms[0];
  return forms[2];
}

/**
 * Строит список допустимых значений количества для категории:
 * либо перечисленные наборы, либо диапазон с шагом.
 */
export function getQuantityOptions(rule: {
  presets?: number[];
  min?: number;
  max?: number;
  step?: number;
  defaultValue: number;
}): number[] {
  if (rule.presets?.length) return rule.presets;

  const { min, max, step } = rule;
  if (min === undefined || max === undefined || !step) return [rule.defaultValue];

  const options: number[] = [];
  // Считаем через индекс, а не накоплением: иначе дробный шаг накопит погрешность.
  const count = Math.floor((max - min) / step);
  for (let index = 0; index <= count; index += 1) {
    options.push(roundRubles(min + index * step));
  }
  return options;
}
