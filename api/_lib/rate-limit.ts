/**
 * Ограничение частоты заявок по IP-адресу.
 *
 * Счётчики живут в Firestore, а не в памяти процесса, и это принципиально:
 * Vercel поднимает несколько инстансов функции параллельно, и лимит «в
 * памяти» обходился бы простым повтором запроса — он с большой вероятностью
 * попал бы на другой инстанс со своим чистым счётчиком.
 *
 * Плата за надёжность — одна запись в базу на попытку заказа. При объёмах
 * домашней кондитерской это несопоставимо с бесплатным лимитом Firestore.
 */

import { createHash } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';

/** Не больше двух заявок в минуту с одного адреса (ТЗ v3, п. 3.2). */
const MAX_REQUESTS = 2;
const WINDOW_MS = 60_000;

/**
 * Уборка просроченных счётчиков.
 *
 * Изначально предполагалось правило TTL в самом Firestore, но оно требует
 * включённого биллинга, а проект намеренно живёт на бесплатном плане Spark.
 * Поэтому подчищаем сами: изредка, прямо в ходе обычной проверки лимита.
 *
 * Раз в двадцать вызовов достаточно с огромным запасом. Счётчик просрочен
 * через десять минут после последней попытки, а заявок у домашнего кондитера
 * в день считанные единицы — коллекция физически не успеет вырасти.
 */
const SWEEP_PROBABILITY = 0.05;
/** Сколько документов удаляем за один заход. Ограничение бережёт и время
 *  ответа, и бесплатную квоту на запись. */
const SWEEP_BATCH = 25;

/**
 * IP-адрес — персональные данные, поэтому в базе лежит только его хэш.
 * Соль из окружения не даёт восстановить адрес перебором: без неё диапазон
 * IPv4 перебирается за секунды.
 */
function hashIp(ip: string): string {
  const salt = process.env.RATE_LIMIT_SALT ?? 'candy-ksendy';
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}

/** Достаём адрес клиента из заголовков прокси Vercel. */
export function getClientIp(headers: Record<string, string | string[] | undefined>): string {
  const forwarded = headers['x-forwarded-for'];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const first = value?.split(',')[0]?.trim();
  return first && first.length > 0 ? first : 'unknown';
}

export interface RateLimitResult {
  isAllowed: boolean;
  /** Через сколько секунд можно повторить. */
  retryAfterSeconds: number;
}

/**
 * Удаляет просроченные счётчики. Ошибки намеренно поглощаются: уборка —
 * дело фоновое, и ронять из-за неё оформление заказа нельзя.
 */
async function sweepExpired(db: Firestore): Promise<void> {
  try {
    const expired = await db
      .collection('rate_limits')
      .where('expiresAt', '<', new Date())
      .limit(SWEEP_BATCH)
      .get();

    if (expired.empty) return;

    const batch = db.batch();
    for (const document of expired.docs) batch.delete(document.ref);
    await batch.commit();

    console.info(`[rate-limit] Удалено просроченных счётчиков: ${expired.size}`);
  } catch (error) {
    console.error('[rate-limit] Уборка не выполнена:', error);
  }
}

export async function checkRateLimit(db: Firestore, ip: string): Promise<RateLimitResult> {
  const reference = db.collection('rate_limits').doc(hashIp(ip));
  const now = Date.now();

  // Изредка подчищаем коллекцию. Делаем это до проверки лимита, чтобы уборка
  // не влияла на решение о пропуске запроса и не задерживала уже принятый заказ.
  if (Math.random() < SWEEP_PROBABILITY) await sweepExpired(db);

  try {
    return await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      const previous: number[] = snapshot.exists ? (snapshot.data()?.timestamps ?? []) : [];

      // Оставляем только попытки внутри окна.
      const recent = previous.filter((timestamp) => now - timestamp < WINDOW_MS);

      if (recent.length >= MAX_REQUESTS) {
        const oldest = Math.min(...recent);
        return {
          isAllowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil((WINDOW_MS - (now - oldest)) / 1000)),
        };
      }

      transaction.set(reference, {
        timestamps: [...recent, now],
        // Момент, после которого счётчик не нужен. По нему и работает
        // уборка в sweepExpired. Поле называется expiresAt, чтобы при
        // переходе на план Blaze хватило включить TTL — код менять не придётся.
        expiresAt: new Date(now + WINDOW_MS * 10),
      });

      return { isAllowed: true, retryAfterSeconds: 0 };
    });
  } catch (error) {
    // Сбой счётчика не должен блокировать реальные заказы: теряем защиту,
    // но не теряем заявку. Ошибку пишем в лог, чтобы она не прошла незаметно.
    console.error('[rate-limit] Проверка не выполнена, пропускаем запрос:', error);
    return { isAllowed: true, retryAfterSeconds: 0 };
  }
}
