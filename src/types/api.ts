/**
 * Контракт между браузером и серверной функцией `/api/order`.
 *
 * Общий файл для клиента и бэкенда: функция Vercel импортирует его напрямую,
 * поэтому поля физически не могут разъехаться.
 *
 * Ключевое правило безопасности: клиент НЕ передаёт цену. Он присылает только
 * идентификаторы выбранного и количество, а сервер сам достаёт цены из
 * Firestore и считает сумму. Подменить итог через консоль браузера нельзя.
 */

/** Имя скрытого поля-ловушки. Должно совпадать на клиенте и на сервере. */
export const HONEYPOT_FIELD = 'biscuit_extra_accent';

export interface OrderRequestClient {
  name: string;
  phone: string;
  telegram: string;
}

export interface OrderRequest {
  categoryId: string;
  /** Идентификаторы выбранных компонентов: начинка, тесто, обсыпки, декор. */
  componentIds: string[];
  /** Вес в килограммах либо количество штук или наборов. */
  quantity: number;
  client: OrderRequestClient;
  /** Дата и время самовывоза в формате ISO. */
  pickupAt: string;
  /** Текст надписи на торте, если выбран соответствующий декор. */
  inscription?: string;
  /** Пожелания клиента: аллергии, детали декора. */
  comment?: string;
  /** Согласие на обработку персональных данных. Без него заявка не принимается. */
  consent: boolean;
  source: 'telegram_mini_app' | 'web_site';
  /** Подписанные данные Telegram — сервер проверяет подпись. */
  initData?: string;
  /** Ловушка для ботов. Человек это поле не видит и не заполняет. */
  [HONEYPOT_FIELD]?: string;
}

export interface OrderSuccessResponse {
  ok: true;
  /** Короткий идентификатор заявки: #ck-9f82. */
  orderId: string;
  /** Итоговая сумма, посчитанная сервером. */
  total: number;
}

export interface OrderErrorResponse {
  ok: false;
  /** Сообщение для показа пользователю — уже на русском. */
  error: string;
  /** Ошибки по конкретным полям формы: имя поля → текст подсказки. */
  fields?: Record<string, string>;
}

export type OrderResponse = OrderSuccessResponse | OrderErrorResponse;

/* ───────────────────────── Админка ───────────────────────── */

/**
 * Заявки закрыты правилами Firestore даже на чтение, поэтому админка
 * получает их через сервер. Здесь описан ровно тот набор полей, который
 * нужен журналу, — лишнего в браузер не уходит.
 */

/** Единственное объявление статуса живёт в доменных типах — здесь только ссылка. */
import type { OrderStatus } from './index.js';
export type { OrderStatus };

/** Подписи статусов. Одни и те же в админке, в таблице и в уведомлениях. */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Новая',
  confirmed: 'Подтверждена',
  completed: 'Выдана',
  cancelled: 'Отменена',
};

export interface AdminOrderDetail {
  label: string;
  value: string;
}

export interface AdminOrder {
  id: string;
  client: { name: string; phone: string; telegram: string };
  product: {
    categoryName: string;
    details: AdminOrderDetail[];
    quantity: number;
    unitLabel: string;
    price: number;
    inscription: string | null;
  };
  pickupTime: string;
  comment: string | null;
  status: OrderStatus;
  source: 'telegram_mini_app' | 'web_site';
  isTelegramVerified: boolean;
  createdAt: string;
  /** Заполнено, если заявка не дошла до таблицы или до Telegram. */
  deliveryIssues?: { sheets: string | null; telegram: string | null } | null;
}

export interface AdminOrdersResponse {
  ok: true;
  orders: AdminOrder[];
}

export interface OrderStatusRequest {
  orderId: string;
  status: OrderStatus;
}

export interface OrderStatusResponse {
  ok: true;
  status: OrderStatus;
  /**
   * Удалось ли обновить статус в Google Таблице.
   * Заявка в базе меняется в любом случае: рассинхрон с таблицей —
   * повод показать предупреждение, а не отменять действие.
   */
  sheetSynced: boolean;
  sheetError?: string;
}

export interface AdminErrorResponse {
  ok: false;
  error: string;
}
