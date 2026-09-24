/**
 * Отправка заявки на серверную функцию Vercel.
 *
 * Клиент передаёт только идентификаторы выбранного и количество — цену
 * считает сервер. Здесь её нет намеренно: значение из браузера всё равно
 * не было бы принято.
 */

import type { ConstructorState } from '@/types';
import type { OrderRequest, OrderResponse } from '@/types/api';
import { getWebApp } from '@/lib/telegram';
import { normalizeTelegram } from '@/lib/validation';

const ENDPOINT = '/api/order';

/** Собирает плоский список идентификаторов из выбора по шагам. */
export function collectComponentIds(state: ConstructorState): string[] {
  return Object.values(state.selection)
    .flatMap((components) => components ?? [])
    .map((component) => component.id);
}

export interface SubmitOrderParams {
  state: ConstructorState;
  name: string;
  phone: string;
  telegram: string;
  pickupAt: string;
  comment: string;
  /** Значение поля-ловушки. У человека оно всегда пустое. */
  honeypot: string;
}

export async function submitOrder({
  state,
  name,
  phone,
  telegram,
  pickupAt,
  comment,
  honeypot,
}: SubmitOrderParams): Promise<OrderResponse> {
  if (!state.category || state.quantity === null) {
    return { ok: false, error: 'Десерт ещё не собран' };
  }

  const webApp = getWebApp();

  const payload: OrderRequest = {
    categoryId: state.category.id,
    componentIds: collectComponentIds(state),
    quantity: state.quantity,
    client: {
      name: name.trim(),
      phone: phone.trim(),
      telegram: normalizeTelegram(telegram),
    },
    // datetime-local отдаёт местное время без пояса — переводим в ISO,
    // иначе сервер прочитает его как UTC и заказ уедет на три часа.
    pickupAt: new Date(pickupAt).toISOString(),
    inscription: state.inscription.trim() || undefined,
    comment: comment.trim() || undefined,
    consent: true,
    source: webApp ? 'telegram_mini_app' : 'web_site',
    initData: webApp?.initData,
    biscuit_extra_accent: honeypot,
  };

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // Сервер отвечает разобранным JSON и на успех, и на отказ.
    const data = (await response.json()) as OrderResponse;
    return data;
  } catch {
    // Сеть отвалилась. Собранный десерт остаётся в состоянии приложения,
    // повторная отправка не потребует собирать его заново.
    return {
      ok: false,
      error:
        'Проблемы с сетью. Ваш собранный десерт бережно сохранён, попробуйте отправить заявку ещё раз через несколько секунд',
    };
  }
}
