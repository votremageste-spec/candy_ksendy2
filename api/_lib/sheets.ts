/**
 * Запись заявки в Google Таблицу Ксении.
 *
 * Без библиотеки googleapis: она тянет десятки мегабайт зависимостей ради
 * одного вызова. Здесь JWT подписывается встроенным crypto, токен берётся
 * обычным fetch — функция остаётся лёгкой, холодный старт быстрым.
 *
 * Запись идёт методом append: он сам находит первую пустую строку. Благодаря
 * этому заметки, которые Ксения пишет вручную в столбцах L–N, никогда не
 * затираются новыми заявками.
 *
 * Структура столбцов — из Google_Sheets_Structure_Candy_Ksendy.md:
 * A — ID заявки, B — дата подачи, C — клиент, D — телефон, E — Telegram,
 * F — категория, G — состав, H — объём, I — декор и пожелания,
 * J — дата выдачи, K — расчётная цена, L — предоплата (вручную),
 * M — статус, N — заметки кондитера (вручную).
 */

import { createSign } from 'node:crypto';
import type { VerifiedOrder } from './order-pricing.js';
import type { OrderRequest, OrderStatus } from '../../src/types/api.js';

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const DEFAULT_SHEET_NAME = 'Лист1';

/** Статус по умолчанию — модель «заявка на согласовании», а не оплаченный заказ. */
const INITIAL_STATUS = '⏳ На согласовании';

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Получение access-токена по сервисному аккаунту.
 * Стандартный поток JWT Bearer: подписываем утверждение приватным ключом
 * и меняем его на токен.
 */
async function getAccessToken(): Promise<string> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !rawKey) {
    throw new Error('Не заданы GOOGLE_SERVICE_ACCOUNT_EMAIL или GOOGLE_PRIVATE_KEY');
  }

  const privateKey = rawKey.replace(/\\n/g, '\n');
  const issuedAt = Math.floor(Date.now() / 1000);

  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(
    JSON.stringify({
      iss: email,
      scope: SCOPE,
      aud: 'https://oauth2.googleapis.com/token',
      iat: issuedAt,
      exp: issuedAt + 3600,
    }),
  );

  const signature = base64url(
    createSign('RSA-SHA256').update(`${header}.${payload}`).sign(privateKey),
  );

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${payload}.${signature}`,
    }),
  });

  if (!response.ok) {
    throw new Error(`Google не выдал токен (${response.status}): ${await response.text()}`);
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error('В ответе Google нет access_token');
  }

  return data.access_token;
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

interface AppendParams {
  orderId: string;
  order: VerifiedOrder;
  request: OrderRequest;
}

/** Ссылка на таблицу для сообщения в Telegram. */
export function getSpreadsheetUrl(): string | undefined {
  const id = process.env.GOOGLE_SPREADSHEET_ID;
  return id ? `https://docs.google.com/spreadsheets/d/${id}` : undefined;
}

/**
 * Добавляет строку заявки. Как и уведомление в Telegram, не бросает
 * исключение: заявка уже в базе, и сбой таблицы не повод показывать клиенту
 * ошибку. Возвращает описание проблемы для лога.
 */
export async function appendOrderRow({
  orderId,
  order,
  request,
}: AppendParams): Promise<string | null> {
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  if (!spreadsheetId) {
    return 'Не задана переменная GOOGLE_SPREADSHEET_ID';
  }

  const sheetName = process.env.GOOGLE_SHEET_NAME ?? DEFAULT_SHEET_NAME;

  // Декор и пожелания складываем в один столбец: для Ксении это единый
  // блок «что ещё учесть», разносить его по колонкам смысла нет.
  const wishes = [
    request.inscription ? `Надпись: «${request.inscription}»` : '',
    request.comment ?? '',
  ]
    .filter(Boolean)
    .join('. ');

  const row = [
    orderId,
    formatDateTime(new Date().toISOString()),
    request.client.name,
    request.client.phone,
    request.client.telegram,
    order.category.shortName,
    order.details.map((detail) => `${detail.label}: ${detail.value}`).join('; '),
    `${order.quantity} ${order.category.quantity.unitLabel}`,
    wishes,
    formatDateTime(request.pickupAt),
    order.total,
    '', // L — предоплата, заполняет Ксения
    INITIAL_STATUS,
    '', // N — заметки кондитера, заполняет Ксения
  ];

  try {
    const token = await getAccessToken();
    const range = encodeURIComponent(`${sheetName}!A:N`);

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append` +
        '?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [row] }),
      },
    );

    if (!response.ok) {
      return `Google Sheets ответил ${response.status}: ${await response.text()}`;
    }

    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Неизвестная ошибка Google Sheets';
  }
}

/**
 * Подписи статусов в таблице. Со значками — так строка читается взглядом,
 * без вчитывания: Ксения смотрит таблицу с телефона.
 */
export const SHEET_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: INITIAL_STATUS,
  confirmed: '✅ Подтверждена',
  completed: '🎂 Выдана',
  cancelled: '✖️ Отменена',
};

/**
 * Обновляет статус заявки в таблице.
 *
 * Строка ищется по номеру заявки в столбце A, а не запоминается при создании.
 * Так синхронизация переживает и ручную сортировку, и вставку строк: Ксения
 * работает с таблицей как с обычной таблицей, а не как с базой данных.
 *
 * Как и запись заявки, ошибок не бросает — возвращает описание проблемы.
 * Статус в Firestore к этому моменту уже изменён, и откатывать его из-за
 * недоступности таблицы неправильно: заявка важнее её отражения в отчёте.
 */
export async function updateOrderStatusInSheet(
  orderId: string,
  status: OrderStatus,
): Promise<string | null> {
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  if (!spreadsheetId) {
    return 'Не задана переменная GOOGLE_SPREADSHEET_ID';
  }

  const sheetName = process.env.GOOGLE_SHEET_NAME ?? DEFAULT_SHEET_NAME;

  try {
    const token = await getAccessToken();
    const headers = { Authorization: `Bearer ${token}` };

    // Шаг 1: читаем столбец с номерами заявок и ищем нужную строку.
    const lookupRange = encodeURIComponent(`${sheetName}!A:A`);
    const lookup = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${lookupRange}`,
      { headers },
    );

    if (!lookup.ok) {
      return `Google Sheets ответил ${lookup.status} при поиске строки: ${await lookup.text()}`;
    }

    const values: string[][] = ((await lookup.json()) as { values?: string[][] }).values ?? [];
    const index = values.findIndex((row) => row[0]?.trim() === orderId);

    if (index === -1) {
      return `Строка с заявкой ${orderId} в таблице не найдена`;
    }

    // Нумерация строк в таблице начинается с единицы.
    const rowNumber = index + 1;

    // Шаг 2: пишем новый статус в столбец M найденной строки.
    const targetRange = encodeURIComponent(`${sheetName}!M${rowNumber}`);
    const update = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${targetRange}` +
        '?valueInputOption=USER_ENTERED',
      {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [[SHEET_STATUS_LABELS[status]]] }),
      },
    );

    if (!update.ok) {
      return `Google Sheets ответил ${update.status} при записи статуса: ${await update.text()}`;
    }

    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Неизвестная ошибка Google Sheets';
  }
}

/**
 * Удаляет строку заявки из таблицы.
 *
 * Как и запись, и смена статуса, ошибок не бросает — заявка уже удалена
 * из Firestore, и недоступность таблицы не повод откатывать это решение.
 * Строка ищется по номеру заявки в столбце A на момент вызова: заранее
 * запоминать номер строки нельзя, Ксения могла отсортировать таблицу.
 */
export async function deleteOrderRow(orderId: string): Promise<string | null> {
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  if (!spreadsheetId) {
    return 'Не задана переменная GOOGLE_SPREADSHEET_ID';
  }

  const sheetName = process.env.GOOGLE_SHEET_NAME ?? DEFAULT_SHEET_NAME;

  try {
    const token = await getAccessToken();
    const headers = { Authorization: `Bearer ${token}` };

    // Шаг 1: находим числовой sheetId вкладки — deleteDimension требует именно
    // его, а не название листа.
    const meta = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
      { headers },
    );

    if (!meta.ok) {
      return `Google Sheets ответил ${meta.status} при поиске листа: ${await meta.text()}`;
    }

    const metaData = (await meta.json()) as {
      sheets?: { properties?: { sheetId?: number; title?: string } }[];
    };
    const sheetId = metaData.sheets?.find((sheet) => sheet.properties?.title === sheetName)
      ?.properties?.sheetId;

    if (sheetId === undefined) {
      return `Лист «${sheetName}» не найден в таблице`;
    }

    // Шаг 2: ищем строку с нужным номером заявки в столбце A.
    const lookupRange = encodeURIComponent(`${sheetName}!A:A`);
    const lookup = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${lookupRange}`,
      { headers },
    );

    if (!lookup.ok) {
      return `Google Sheets ответил ${lookup.status} при поиске строки: ${await lookup.text()}`;
    }

    const values: string[][] = ((await lookup.json()) as { values?: string[][] }).values ?? [];
    const index = values.findIndex((row) => row[0]?.trim() === orderId);

    if (index === -1) {
      // Строки нет в таблице (не успела попасть или уже удалена) — это не сбой.
      return null;
    }

    // Шаг 3: удаляем найденную строку. startIndex/endIndex — с нуля,
    // полуоткрытый интервал, поэтому конец равен номеру строки без сдвига.
    const batchUpdate = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              deleteDimension: {
                range: { sheetId, dimension: 'ROWS', startIndex: index, endIndex: index + 1 },
              },
            },
          ],
        }),
      },
    );

    if (!batchUpdate.ok) {
      return `Google Sheets ответил ${batchUpdate.status} при удалении строки: ${await batchUpdate.text()}`;
    }

    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Неизвестная ошибка Google Sheets';
  }
}
