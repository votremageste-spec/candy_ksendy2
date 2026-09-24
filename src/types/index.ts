/**
 * Доменные типы Candy_Ksendy.
 *
 * Схема переработана относительно TZ_Candy_Ksendy_v2.md (п. 4) под реальный
 * ассортимент и реальное ценообразование Ксении — см. разбор в файле
 * `Прайс_и_ассортимент_из_канала.md` и обоснование в `ASSUMPTIONS.md`.
 *
 * Ключевое отличие от исходного ТЗ: цена НЕ складывается из надбавок за
 * ингредиенты. У Ксении три разные модели, которые сводятся к одной формуле:
 *
 *      итог = цена за единицу × количество + сумма доплат
 *
 * где «единица» — это килограмм (торты), штука (бенто, моти, куличи) или
 * набор (зефир, мадлен, птичье молоко). Цена за единицу берётся у выбранного
 * варианта — то есть у начинки или вкуса.
 */

/** Что считается единицей измерения и как подписывается в интерфейсе. */
export type PricingUnit = 'kg' | 'piece' | 'set';

/**
 * Шаг конструктора.
 *  variant — позиция или начинка. Обязателен всегда, именно он несёт цену.
 *  dough   — тесто (моти). На цену не влияет.
 *  topping — обсыпка (птичье молоко). Выбирается несколько.
 *  flavor  — состав набора (мадлен, зефир). Выбирается несколько.
 *  decor   — оформление. Может входить в цену, а может быть доплатой.
 */
export type StepType = 'variant' | 'dough' | 'topping' | 'flavor' | 'decor';

/**
 * Описание одного шага конструктора внутри категории.
 *
 * Правила выбора заданы данными, а не кодом: у птичьего молока клиент берёт
 * три обсыпки из четырёх, у мадлена — один или два вкуса, у торта — ровно одну
 * начинку. Всё это разные значения minSelect и maxSelect, а не разные экраны.
 */
export interface ConstructorStep {
  type: StepType;
  /** Заголовок шага: «Начинка», «Обсыпка», «Вкусы в наборе». */
  label: string;
  /** Минимум выборов. Ноль означает, что шаг необязательный. */
  minSelect: number;
  /** Максимум выборов. Единица — обычный выбор одного варианта. */
  maxSelect: number;
  /** Подсказка под заголовком: «Выберите три вкуса — по три конфеты каждого». */
  hint?: string;
}

/** Правила выбора количества внутри категории. */
export interface QuantityRule {
  /** Подпись единицы: «кг», «шт», «набор». */
  unitLabel: string;
  /** Диапазон с шагом — для тортов (1.5…5 кг, шаг 0.5). */
  min?: number;
  max?: number;
  step?: number;
  /** Фиксированный список вариантов — для наборов (4, 6, 9, 12 шт). */
  presets?: number[];
  /** Значение по умолчанию при входе в конструктор. */
  defaultValue: number;
  /**
   * Количество жёстко зафиксировано и пользователем не меняется
   * (бенто — всегда одна штука, зефир — всегда набор из шести).
   */
  isFixed?: boolean;
}

/**
 * Документ коллекции `categories`.
 * Ксения управляет составом категорий из админки, не трогая код.
 */
export interface DessertCategory {
  id: string;
  /** Название во множественном числе для карточки выбора: «Торты». */
  name: string;
  /** Название в единственном числе для сводки заказа: «Торт». */
  shortName: string;
  description: string;
  /** Единица, в которой считается цена. */
  pricingUnit: PricingUnit;
  quantity: QuantityRule;
  /** Какие шаги показывать в конструкторе, в каком порядке и с какими правилами. */
  steps: ConstructorStep[];
  /** Сезонная позиция: куличи и пасхи продаются только перед Пасхой. */
  isSeasonal: boolean;
  /** Тумблер в админке: скрывает категорию целиком. */
  isActive: boolean;
  sortOrder: number;
  imageUrl: string;
}

/**
 * Документ коллекции `components` — вариант или опция внутри категории.
 *
 * Для шага `variant` поле `price` — это цена за единицу (за кг, за штуку,
 * за набор). Для остальных шагов `price` — доплата, чаще всего нулевая.
 */
export interface DessertComponent {
  id: string;
  categoryId: string;
  type: StepType;
  name: string;
  /** Состав или аппетитное описание. Показывается в карточке. */
  description: string;
  /**
   * Цена за единицу (для variant) или доплата (для остальных шагов).
   * Ксения меняет это значение прямо в админке.
   */
  price: number;
  /**
   * Цена не подтверждена и требует внимания Ксении.
   * Такие позиции подсвечиваются в админке и скрыты от клиентов до уточнения.
   */
  needsPriceReview: boolean;
  /** Тумблер наличия. false — карточка видна, но заблокирована. */
  inStock: boolean;
  imageUrl: string;
  sortOrder: number;
}

/**
 * Выбор пользователя по шагам.
 * Всегда массив, даже когда выбрать можно только одно — так у конструктора
 * и калькулятора остаётся ровно одна ветка логики вместо двух.
 */
export type StepSelection = Partial<Record<StepType, DessertComponent[]>>;

/** Состояние конструктора между шагами. Живёт в AppContext. */
export interface ConstructorState {
  category: DessertCategory | null;
  selection: StepSelection;
  /** Вес в килограммах или количество штук/наборов. */
  quantity: number | null;
  /** Текст надписи на торте, если выбран декор с надписью. */
  inscription: string;
}

export const EMPTY_CONSTRUCTOR_STATE: ConstructorState = {
  category: null,
  selection: {},
  quantity: null,
  inscription: '',
};

/* ───────────────────────────── Заказы ───────────────────────────── */

export interface OrderClient {
  name: string;
  phone: string;
  telegram: string;
  source: 'telegram_mini_app' | 'web_site';
}

/** Состав собранного десерта в человекочитаемом виде — для Telegram и таблицы. */
export interface OrderProductDetails {
  /** Подпись шага → выбранное значение. Например: «Начинка» → «Чёрный лес». */
  label: string;
  value: string;
}

export interface OrderProduct {
  categoryId: string;
  categoryName: string;
  details: OrderProductDetails[];
  quantity: number;
  unitLabel: string;
  /**
   * Итоговая стоимость, посчитанная на клиенте.
   * Бэкенд обязан пересчитать её самостоятельно и не доверять этому значению.
   */
  price: number;
  inscription?: string;
}

/**
 * Состояние заявки. Отмена нужна отдельным значением: заявка, от которой
 * клиент отказался, не «выдана» и не должна теряться среди новых.
 */
export type OrderStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

/** Документ коллекции `orders`. */
export interface Order {
  id: string;
  client: OrderClient;
  product: OrderProduct;
  /** ISO-строка даты и времени самовывоза. */
  pickupTime: string;
  status: OrderStatus;
  createdAt: string;
  /** Комментарий клиента: аллергии, пожелания. */
  comment?: string;
  /** Номер строки в Google Таблице — нужен, чтобы обновлять статус. */
  sheetRow?: number;
}
