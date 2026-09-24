/**
 * GET /api/orders — список заявок для админки.
 *
 * Коллекция `orders` закрыта правилами Firestore даже на чтение, поэтому
 * журнал получает данные отсюда. Это не лишний слой: так браузер вообще не
 * имеет доступа к базе заявок, и утечка возможна только через этот маршрут,
 * который проверяет и подпись токена, и роль в базе.
 *
 * Сортировка по дате самовывоза: Ксении важно, что печь завтра, а не что
 * заказали позавчера.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from './_lib/firebase-admin.js';
import { AdminAuthError, requireAdmin } from './_lib/admin-auth.js';
import type {
  AdminErrorResponse,
  AdminOrder,
  AdminOrdersResponse,
} from '../src/types/api.js';

/** Сколько заявок отдаём за раз. Больше на экране всё равно не осмотреть. */
const LIMIT = 200;

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
): Promise<void> {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    response
      .status(405)
      .json({ ok: false, error: 'Метод не поддерживается' } as AdminErrorResponse);
    return;
  }

  let db;
  try {
    db = getDb();
  } catch (error) {
    console.error('[orders] Firebase Admin не сконфигурирован:', error);
    response
      .status(500)
      .json({ ok: false, error: 'Сервис временно недоступен' } as AdminErrorResponse);
    return;
  }

  try {
    await requireAdmin(request, db);
  } catch (error) {
    if (error instanceof AdminAuthError) {
      response.status(error.status).json({ ok: false, error: error.message } as AdminErrorResponse);
      return;
    }
    console.error('[orders] Сбой проверки прав:', error);
    response
      .status(500)
      .json({ ok: false, error: 'Не удалось проверить права' } as AdminErrorResponse);
    return;
  }

  try {
    const snapshot = await db
      .collection('orders')
      .orderBy('pickupTime', 'desc')
      .limit(LIMIT)
      .get();

    const orders: AdminOrder[] = snapshot.docs.map((document) => {
      const data = document.data();

      return {
        id: data.id ?? document.id,
        client: {
          name: data.client?.name ?? '',
          phone: data.client?.phone ?? '',
          telegram: data.client?.telegram ?? '',
        },
        product: {
          categoryName: data.product?.categoryName ?? '',
          details: Array.isArray(data.product?.details) ? data.product.details : [],
          quantity: data.product?.quantity ?? 0,
          unitLabel: data.product?.unitLabel ?? '',
          price: data.product?.price ?? 0,
          inscription: data.product?.inscription ?? null,
        },
        pickupTime: data.pickupTime ?? '',
        comment: data.comment ?? null,
        status: data.status ?? 'pending',
        source: data.source === 'telegram_mini_app' ? 'telegram_mini_app' : 'web_site',
        isTelegramVerified: data.isTelegramVerified === true,
        createdAt: data.createdAt ?? '',
        deliveryIssues: data.deliveryIssues ?? null,
      };
    });

    response.status(200).json({ ok: true, orders } as AdminOrdersResponse);
  } catch (error) {
    console.error('[orders] Не удалось прочитать заявки:', error);
    response
      .status(500)
      .json({ ok: false, error: 'Не удалось загрузить заявки' } as AdminErrorResponse);
  }
}
