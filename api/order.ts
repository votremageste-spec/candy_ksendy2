/**
 * POST /api/order — приём заявки на десерт.
 *
 * Единственная точка записи в коллекцию `orders`: для браузера она закрыта
 * правилами Firestore наглухо, сюда же запросы приходят через Admin SDK.
 *
 * Порядок проверок выбран так, чтобы самые дешёвые отсекали мусор первыми:
 *   1. метод запроса;
 *   2. ловушка для ботов — без единого обращения к базе;
 *   3. ограничение частоты по IP;
 *   4. валидация полей формы теми же правилами, что и на клиенте;
 *   5. сверка состава и пересчёт цены по данным из базы.
 *
 * Запись заявки в Firestore считается критической: не удалась — клиент видит
 * ошибку. Уведомление в Telegram и строка в таблице — вспомогательные: если
 * они упали, заявка всё равно принята, а проблема уходит в лог. Терять заказ
 * из-за недоступности постороннего сервиса недопустимо.
 */

import { randomBytes } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from './_lib/firebase-admin.js';
import { checkRateLimit, getClientIp } from './_lib/rate-limit.js';
import { OrderValidationError, verifyAndPrice } from './_lib/order-pricing.js';
import {
  buildOrderMessage,
  sendTelegramNotification,
  verifyInitData,
} from './_lib/telegram.js';
import { appendOrderRow, getSpreadsheetUrl } from './_lib/sheets.js';
import { HONEYPOT_FIELD, type OrderRequest, type OrderResponse } from '../src/types/api.js';
import { normalizePhone, normalizeTelegram, validateCheckout } from '../src/lib/validation.js';

/** Короткий идентификатор заявки: его удобно называть в переписке. */
function generateOrderId(): string {
  return `#ck-${randomBytes(2).toString('hex')}`;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
): Promise<void> {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    response.status(405).json({ ok: false, error: 'Метод не поддерживается' } as OrderResponse);
    return;
  }

  const body = request.body as Partial<OrderRequest> | undefined;

  if (!body || typeof body !== 'object') {
    response.status(400).json({ ok: false, error: 'Пустой запрос' } as OrderResponse);
    return;
  }

  /*
   * Ловушка для ботов. Поле скрыто от человека, поэтому заполнить его может
   * только автомат. Отвечаем успехом с выдуманным номером: бот считает
   * рассылку удачной и не подбирает обход, а до базы запрос не доходит.
   */
  if (isNonEmptyString(body[HONEYPOT_FIELD])) {
    console.warn('[order] Сработала ловушка honeypot, запрос отброшен');
    response.status(200).json({ ok: true, orderId: generateOrderId(), total: 0 });
    return;
  }

  let db;
  try {
    db = getDb();
  } catch (error) {
    console.error('[order] Firebase Admin не сконфигурирован:', error);
    response.status(500).json({
      ok: false,
      error: 'Сервис временно недоступен. Пожалуйста, попробуйте позже',
    } as OrderResponse);
    return;
  }

  const ip = getClientIp(request.headers);
  const rateLimit = await checkRateLimit(db, ip);

  if (!rateLimit.isAllowed) {
    response.setHeader('Retry-After', String(rateLimit.retryAfterSeconds));
    response.status(429).json({
      ok: false,
      error: 'Заявка уже отправляется. Подождите минуту, прежде чем отправлять следующую',
    } as OrderResponse);
    return;
  }

  /* ─────────────────────────── Поля формы ─────────────────────────── */

  const fieldErrors = validateCheckout({
    name: typeof body.client?.name === 'string' ? body.client.name : '',
    phone: typeof body.client?.phone === 'string' ? body.client.phone : '',
    telegram: typeof body.client?.telegram === 'string' ? body.client.telegram : '',
    pickupAt: typeof body.pickupAt === 'string' ? body.pickupAt : '',
    comment: typeof body.comment === 'string' ? body.comment : '',
    consent: body.consent === true,
  });

  if (Object.keys(fieldErrors).length > 0) {
    response.status(400).json({
      ok: false,
      error: 'Проверьте заполнение формы',
      fields: fieldErrors as Record<string, string>,
    } as OrderResponse);
    return;
  }

  if (!isNonEmptyString(body.categoryId) || !Array.isArray(body.componentIds)) {
    response.status(400).json({ ok: false, error: 'Состав заявки не передан' } as OrderResponse);
    return;
  }

  const componentIds = body.componentIds.filter(isNonEmptyString);
  const quantity = Number(body.quantity);

  /* ──────────────── Сверка состава и пересчёт цены ──────────────── */

  let verified;
  try {
    verified = await verifyAndPrice(db, body.categoryId, componentIds, quantity);
  } catch (error) {
    if (error instanceof OrderValidationError) {
      response.status(409).json({ ok: false, error: error.message } as OrderResponse);
      return;
    }
    console.error('[order] Сбой при пересчёте заявки:', error);
    response.status(500).json({
      ok: false,
      error: 'Не удалось проверить состав заказа. Попробуйте ещё раз',
    } as OrderResponse);
    return;
  }

  /*
   * Подпись Telegram. Данные из initDataUnsafe подделываются, поэтому
   * личность считается подтверждённой только после проверки HMAC.
   * Отсутствие подписи — не ошибка: с обычного сайта её и не бывает.
   */
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const isTelegramVerified =
    isNonEmptyString(body.initData) && isNonEmptyString(botToken)
      ? verifyInitData(body.initData, botToken)
      : false;

  const orderId = generateOrderId();
  const createdAt = new Date().toISOString();

  const normalizedRequest: OrderRequest = {
    categoryId: body.categoryId,
    componentIds,
    quantity,
    client: {
      name: body.client!.name.trim(),
      phone: `+${normalizePhone(body.client!.phone)}`,
      telegram: normalizeTelegram(body.client?.telegram ?? ''),
    },
    pickupAt: new Date(body.pickupAt as string).toISOString(),
    inscription: isNonEmptyString(body.inscription) ? body.inscription.trim() : undefined,
    comment: isNonEmptyString(body.comment) ? body.comment.trim() : undefined,
    consent: true,
    source: body.source === 'telegram_mini_app' ? 'telegram_mini_app' : 'web_site',
  };

  /* ───────────────────── Запись заявки в базу ───────────────────── */

  try {
    await db.collection('orders').doc(orderId).set({
      id: orderId,
      client: normalizedRequest.client,
      product: {
        categoryId: verified.category.id,
        categoryName: verified.category.shortName,
        details: verified.details,
        componentIds,
        quantity: verified.quantity,
        unitLabel: verified.category.quantity.unitLabel,
        price: verified.total,
        inscription: normalizedRequest.inscription ?? null,
      },
      pickupTime: normalizedRequest.pickupAt,
      comment: normalizedRequest.comment ?? null,
      status: 'pending',
      source: normalizedRequest.source,
      isTelegramVerified,
      // Подтверждение согласия по 152-ФЗ: фиксируем факт и момент.
      consent: { accepted: true, acceptedAt: createdAt },
      createdAt,
    });
  } catch (error) {
    console.error('[order] Не удалось сохранить заявку:', error);
    response.status(500).json({
      ok: false,
      error: 'Не удалось сохранить заявку. Пожалуйста, попробуйте ещё раз',
    } as OrderResponse);
    return;
  }

  /* ──────────── Побочные каналы: таблица и уведомление ──────────── */

  const [sheetsError, telegramError] = await Promise.all([
    appendOrderRow({ orderId, order: verified, request: normalizedRequest }),
    sendTelegramNotification(
      buildOrderMessage({
        orderId,
        order: verified,
        request: normalizedRequest,
        isTelegramVerified,
        spreadsheetUrl: getSpreadsheetUrl(),
      }),
    ),
  ]);

  if (sheetsError) console.error(`[order] ${orderId}: Google Sheets — ${sheetsError}`);
  if (telegramError) console.error(`[order] ${orderId}: Telegram — ${telegramError}`);

  // Отмечаем в базе, что заявка дошла не по всем каналам: Ксения увидит это
  // в админке и сможет проверить вручную, а не обнаружит пропажу случайно.
  if (sheetsError || telegramError) {
    await db
      .collection('orders')
      .doc(orderId)
      .update({
        deliveryIssues: {
          sheets: sheetsError ?? null,
          telegram: telegramError ?? null,
        },
      })
      .catch((error) => console.error('[order] Не удалось записать пометку о сбое:', error));
  }

  response.status(200).json({ ok: true, orderId, total: verified.total });
}
