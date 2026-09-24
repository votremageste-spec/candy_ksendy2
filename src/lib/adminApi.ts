/**
 * Обращения админки к серверным маршрутам.
 *
 * Заявки закрыты правилами Firestore, поэтому журнал ходит за ними на сервер.
 * Каталог, наоборот, правится напрямую в базе: правила это разрешают
 * администратору, и лишний перелёт через функцию только замедлил бы отклик
 * тумблера наличия.
 */

import { getIdToken } from '@/lib/admin-auth';
import type {
  AdminOrder,
  AdminOrdersResponse,
  OrderStatus,
  OrderStatusResponse,
} from '@/types/api';

/** Ошибка с текстом, готовым к показу. */
export class AdminApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'AdminApiError';
  }
}

async function authorizedFetch(url: string, init?: RequestInit): Promise<unknown> {
  const token = await getIdToken();

  const response = await fetch(url, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // Тело не разобралось — ниже разберёмся по коду ответа.
  }

  if (!response.ok) {
    const message =
      (payload as { error?: string })?.error ??
      (response.status === 401
        ? 'Сессия истекла, войдите заново'
        : 'Сервер вернул ошибку. Попробуйте ещё раз');
    throw new AdminApiError(message, response.status);
  }

  return payload;
}

/** Список заявок, отсортированный по дате самовывоза. */
export async function fetchOrders(): Promise<AdminOrder[]> {
  const payload = (await authorizedFetch('/api/orders')) as AdminOrdersResponse;
  return payload.orders ?? [];
}

/**
 * Смена статуса заявки.
 * Возвращает признак того, удалось ли обновить и Google Таблицу: если нет,
 * админка покажет предупреждение, но само действие останется выполненным.
 */
export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
): Promise<{ sheetSynced: boolean; sheetError?: string }> {
  const payload = (await authorizedFetch('/api/order-status', {
    method: 'POST',
    body: JSON.stringify({ orderId, status }),
  })) as OrderStatusResponse;

  return { sheetSynced: payload.sheetSynced, sheetError: payload.sheetError };
}
