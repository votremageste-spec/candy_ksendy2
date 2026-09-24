/**
 * Telegram: уведомление Ксении и проверка подписи Mini App.
 *
 * Никаких SDK — обычный fetch к Bot API. Это экономит вес функции и время
 * холодного старта, а нужен нам ровно один метод.
 */

import { createHmac } from 'node:crypto';
import type { VerifiedOrder } from './order-pricing.js';
import type { OrderRequest } from '../../src/types/api.js';

/**
 * Проверка подписи данных Telegram Mini App.
 *
 * Поле initDataUnsafe на клиенте подделывается в одну строку, поэтому имени
 * и юзернейму оттуда доверять нельзя. Здесь пересчитывается HMAC по алгоритму
 * из документации Telegram: только он подтверждает, что данные действительно
 * выданы мессенджером и не подменены по дороге.
 */
export function verifyInitData(initData: string, botToken: string): boolean {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return false;

    params.delete('hash');

    const checkString = [...params.entries()]
      .map(([key, value]) => `${key}=${value}`)
      .sort()
      .join('\n');

    const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
    const computed = createHmac('sha256', secretKey).update(checkString).digest('hex');

    return computed === hash;
  } catch {
    return false;
  }
}

/** Экранирование под parse_mode HTML: имя клиента может содержать угловые скобки. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Moscow',
  });
}

interface NotifyParams {
  orderId: string;
  order: VerifiedOrder;
  request: OrderRequest;
  /** Подтверждена ли личность клиента подписью Telegram. */
  isTelegramVerified: boolean;
  /** Ссылка на таблицу, если запись прошла успешно. */
  spreadsheetUrl?: string;
}

/** Карточка заявки для личных сообщений Ксении. */
export function buildOrderMessage({
  orderId,
  order,
  request,
  isTelegramVerified,
  spreadsheetUrl,
}: NotifyParams): string {
  const lines: string[] = [];

  lines.push(`🍰 <b>НОВАЯ ЗАЯВКА ${escapeHtml(orderId)}</b>`);
  lines.push('');
  lines.push(`👤 <b>Клиент:</b> ${escapeHtml(request.client.name)}`);
  lines.push(`📞 <b>Телефон:</b> ${escapeHtml(request.client.phone)}`);

  if (request.client.telegram) {
    const verifiedMark = isTelegramVerified ? ' ✅' : '';
    lines.push(`💬 <b>Telegram:</b> ${escapeHtml(request.client.telegram)}${verifiedMark}`);
  }

  lines.push(
    `🌐 <b>Источник:</b> ${request.source === 'telegram_mini_app' ? 'Telegram Mini App' : 'Сайт'}`,
  );
  lines.push('');
  lines.push(
    `🎂 <b>${escapeHtml(order.category.shortName)}</b> — ${order.quantity} ${escapeHtml(
      order.category.quantity.unitLabel,
    )}`,
  );

  for (const detail of order.details) {
    lines.push(`  • ${escapeHtml(detail.label)}: ${escapeHtml(detail.value)}`);
  }

  if (request.inscription) {
    lines.push(`  ✍️ Надпись: «${escapeHtml(request.inscription)}»`);
  }

  if (request.comment) {
    lines.push('');
    lines.push(`📝 <b>Пожелания:</b> ${escapeHtml(request.comment)}`);
  }

  lines.push('');
  lines.push(`📅 <b>Желаемая выдача:</b> ${formatDateTime(request.pickupAt)}`);
  lines.push(`💰 <b>Расчётная стоимость:</b> ${order.total.toLocaleString('ru-RU')} ₽`);

  if (spreadsheetUrl) {
    lines.push('');
    lines.push(`📂 <a href="${spreadsheetUrl}">Открыть таблицу заявок</a>`);
  }

  lines.push('');
  lines.push('<i>Статус: ⏳ На согласовании. Свяжитесь с клиентом для подтверждения.</i>');

  return lines.join('\n');
}

/**
 * Отправка сообщения. Не бросает исключение: заявка уже сохранена в базе,
 * и падение уведомления не должно превращаться в ошибку для клиента.
 * Возвращает текст проблемы, чтобы вызывающий код записал её в лог.
 */
export async function sendTelegramNotification(text: string): Promise<string | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

  if (!token || !chatId) {
    return 'Не заданы TELEGRAM_BOT_TOKEN или TELEGRAM_ADMIN_CHAT_ID';
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      return `Telegram ответил ${response.status}: ${await response.text()}`;
    }

    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Неизвестная ошибка Telegram';
  }
}
