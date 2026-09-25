/**
 * POST /api/order-delete — удаление заявки из админки.
 *
 * Удаляет в двух местах сразу: в базе и в Google Таблице Ксении.
 * База — источник истины, таблица — отчёт. Поэтому порядок именно такой:
 * сначала удаление в Firestore, и только потом попытка убрать строку из
 * таблицы. Если таблица недоступна, действие не отменяется: заявки уже нет
 * в базе, а о рассинхроне админка честно предупредит.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from './_lib/firebase-admin.js';
import { AdminAuthError, requireAdmin } from './_lib/admin-auth.js';
import { deleteOrderRow } from './_lib/sheets.js';
import type {
  AdminErrorResponse,
  OrderDeleteRequest,
  OrderDeleteResponse,
} from '../src/types/api.js';

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
    console.error('[order-delete] Firebase Admin не сконфигурирован:', error);
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
    console.error('[order-delete] Сбой проверки прав:', error);
    response
      .status(500)
      .json({ ok: false, error: 'Не удалось проверить права' } as AdminErrorResponse);
    return;
  }

  const body = request.body as Partial<OrderDeleteRequest> | undefined;

  if (!body || typeof body.orderId !== 'string') {
    response
      .status(400)
      .json({ ok: false, error: 'Не передан номер заявки' } as AdminErrorResponse);
    return;
  }

  const { orderId } = body as OrderDeleteRequest;
  const reference = db.collection('orders').doc(orderId);

  try {
    const snapshot = await reference.get();
    if (!snapshot.exists) {
      response.status(404).json({ ok: false, error: 'Заявка не найдена' } as AdminErrorResponse);
      return;
    }

    await reference.delete();
  } catch (error) {
    console.error('[order-delete] Не удалось удалить заявку:', error);
    response
      .status(500)
      .json({ ok: false, error: 'Не удалось удалить заявку' } as AdminErrorResponse);
    return;
  }

  const sheetError = await deleteOrderRow(orderId);

  if (sheetError) {
    console.error(`[order-delete] ${orderId}: Google Sheets — ${sheetError}`);
  }

  response.status(200).json({
    ok: true,
    sheetSynced: sheetError === null,
    sheetError: sheetError ?? undefined,
  } as OrderDeleteResponse);
}
