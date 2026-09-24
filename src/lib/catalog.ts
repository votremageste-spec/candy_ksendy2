/**
 * Загрузка каталога.
 *
 * Источник данных зависит от того, настроен ли Firebase:
 *  • настроен  — подписка на Firestore через onSnapshot. Ксения меняет цену или
 *    гасит тумблер наличия в админке, и у всех открытых конструкторов карточка
 *    обновляется мгновенно, без перезагрузки (UX-flow, п. 4.2);
 *  • не настроен — встроенные данные засева. Без этого запаса конструктор
 *    нельзя было бы ни посмотреть, ни проверить до подключения базы.
 *
 * Резервный источник — осознанный компромисс на время разработки, а не
 * постоянное решение: как только появится конфиг, приложение само перейдёт
 * на живые данные, а поле `source` покажет, откуда они пришли.
 */

import { collection, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { isFirebaseConfigured, requireFirestore } from '@/lib/firebase';
import { CATEGORIES_SEED, COMPONENTS_SEED } from '@/data/catalog.seed';
import type { DessertCategory, DessertComponent } from '@/types';

export type CatalogSource = 'firestore' | 'seed';

export interface CatalogSnapshot {
  categories: DessertCategory[];
  components: DessertComponent[];
  source: CatalogSource;
}

/** Категории, доступные клиенту: включённые, в порядке сортировки. */
export function getVisibleCategories(categories: DessertCategory[]): DessertCategory[] {
  return categories.filter((category) => category.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Компоненты одного шага категории.
 * Позиции без подтверждённой цены скрыты: показывать «0 ₽» клиенту нельзя.
 */
export function getStepComponents(
  components: DessertComponent[],
  categoryId: string,
  type: string,
): DessertComponent[] {
  return components
    .filter(
      (component) =>
        component.categoryId === categoryId &&
        component.type === type &&
        !component.needsPriceReview,
    )
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Подписка на каталог.
 * Возвращает функцию отписки — вызывать при размонтировании.
 */
export function subscribeToCatalog(
  onData: (snapshot: CatalogSnapshot) => void,
  onError: (message: string) => void,
): Unsubscribe {
  if (!isFirebaseConfigured) {
    // Отдаём запасные данные асинхронно, чтобы порядок вызовов совпадал
    // с реальной подпиской и интерфейс не мигал состоянием загрузки.
    const timer = setTimeout(() => {
      onData({ categories: CATEGORIES_SEED, components: COMPONENTS_SEED, source: 'seed' });
    }, 0);
    return () => clearTimeout(timer);
  }

  const db = requireFirestore();

  let categories: DessertCategory[] | null = null;
  let components: DessertComponent[] | null = null;

  // Отдаём наружу только когда пришли обе коллекции: иначе конструктор
  // на мгновение покажет категорию без единого ингредиента.
  const emitWhenReady = () => {
    if (!categories || !components) return;
    onData({ categories, components, source: 'firestore' });
  };

  const handleError = (error: unknown) => {
    onError(
      error instanceof Error
        ? `Не удалось загрузить каталог: ${error.message}`
        : 'Не удалось загрузить каталог',
    );
  };

  const unsubscribeCategories = onSnapshot(
    collection(db, 'categories'),
    (snapshot) => {
      categories = snapshot.docs.map((document) => document.data() as DessertCategory);
      emitWhenReady();
    },
    handleError,
  );

  const unsubscribeComponents = onSnapshot(
    collection(db, 'components'),
    (snapshot) => {
      components = snapshot.docs.map((document) => document.data() as DessertComponent);
      emitWhenReady();
    },
    handleError,
  );

  return () => {
    unsubscribeCategories();
    unsubscribeComponents();
  };
}
