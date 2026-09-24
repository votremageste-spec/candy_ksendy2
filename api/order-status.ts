/**
 * POST /api/order-status — смена статуса заявки из админки.
 *
 * Меняет статус в двух местах сразу: в базе и в Google Таблице Ксении.
 * База — источник истины, таблица — отчёт. Поэтому порядок именно такой:
 * сначала запись в Firestore, и только потом попытка обновить таблицу.
 *
 * Если таблица недоступна, действие не отменяется: статус в базе уже верный,
 * а о рассинхроне админка честно предупредит, чтобы Ксения поправила строку
 * руками. Откатывать корректное изменение из-за постороннего сервиса нельзя.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from './_lib/firebase-admin.js';
import { AdminAuthError, requireAdmin } from './_lib/admin-auth.js';
import { updateOrderStatusInSheet } from './_lib/sheets.js';
import {
  ORDER_STATUS_LABELS,
  type AdminErrorResponse,
  type OrderStatus,
  type OrderStatusRequest,
  type OrderStatusResponse,
} from '../src/types/api.js';

function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' && value in ORDER_STATUS_LABELS;
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
): Promise<void> {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    response
      .status(405)
      .json({ ok: false, error: 'Метод не поддерживается' } as AdminErrorResponse);
    return;
  }

  let db;
  try {
    db = getDb();
  } catch (error) {
    console.error('[order-status] Firebase Admin не сконфигурирован:', error);
    response
      .status(500)
      .json({ ok: false, error: 'Сервис временно недоступен' } as AdminErrorResponse);
    return;
  }

  let admin;
  try {
    admin = await requireAdmin(request, db);
  } catch (error) {
    if (error instanceof AdminAuthError) {
      response.status(error.status).json({ ok: false, error: error.message } as AdminErrorResponse);
      return;
    }
    console.error('[order-status] Сбой проверки прав:', error);
    response
      .status(500)
      .json({ ok: false, error: 'Не удалось проверить права' } as AdminErrorResponse);
    return;
  }

  const body = request.body as Partial<OrderStatusRequest> | undefined;

  if (!body || typeof body.orderId !== 'string' || !isOrderStatus(body.status)) {
    response
      .status(400)
      .json({ ok: false, error: 'Не переданы номер заявки или новый статус' } as AdminErrorResponse);
    return;
  }

  const { orderId, status } = body as OrderStatusRequest;
  const reference = db.collection('orders').doc(orderId);

  try {
    const snapshot = await reference.get();
    if (!snapshot.exists) {
      response
        .status(404)
        .json({ ok: false, error: 'Заявка не найдена' } as AdminErrorResponse);
      return;
    }

    await reference.update({
      status,
      // История правок: кто и когда менял статус. Пригодится, когда в админку
      // войдут двое и возникнет вопрос, чьё изменение было последним.
      statusUpdatedAt: new Date().toISOString(),
      statusUpdatedBy: admin.email || admin.uid,
    });
  } catch (error) {
    console.error('[order-status] Не удалось изменить статус:', error);
    response
      .status(500)
      .json({ ok: false, error: 'Не удалось изменить статус' } as AdminErrorResponse);
    return;
  }

  const sheetError = await updateOrderStatusInSheet(orderId, status);

  if (sheetError) {
    console.error(`[order-status] ${orderId}: Google Sheets — ${sheetError}`);
  }

  response.status(200).json({
    ok: true,
    status,
    sheetSynced: sheetError === null,
    sheetError: sheetError ?? undefined,
  } as OrderStatusResponse);
}
