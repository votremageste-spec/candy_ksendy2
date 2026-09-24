/**
 * Проверка прав администратора для серверных маршрутов.
 *
 * Админка присылает ID-токен Firebase в заголовке Authorization. Токен
 * подписан Google, подделать его нельзя — но одной подписи мало: она лишь
 * подтверждает, что человек вошёл, а не что он Ксения. Поэтому после проверки
 * подписи роль сверяется с документом `users/{uid}` в базе.
 *
 * Тот же двойной контроль стоит и в firestore.rules: доступ нельзя получить
 * ни подделкой токена, ни самоподписанным claim'ом.
 */

import type { VercelRequest } from '@vercel/node';
import type { Firestore } from 'firebase-admin/firestore';
import { getAdminAuth } from './firebase-admin.js';

export interface AdminIdentity {
  uid: string;
  email: string;
}

/** Причина отказа — с кодом ответа, чтобы маршрут не выдумывал его сам. */
export class AdminAuthError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403,
  ) {
    super(message);
    this.name = 'AdminAuthError';
  }
}

function extractToken(request: VercelRequest): string {
  const header = request.headers.authorization;
  const value = Array.isArray(header) ? header[0] : header;

  if (!value?.startsWith('Bearer ')) {
    throw new AdminAuthError('Требуется вход', 401);
  }

  const token = value.slice('Bearer '.length).trim();
  if (token.length === 0) {
    throw new AdminAuthError('Требуется вход', 401);
  }

  return token;
}

/**
 * Возвращает личность администратора либо бросает AdminAuthError.
 *
 * Проверка идёт в два шага, и оба обязательны:
 *   1. подпись токена — токен настоящий и не истёк;
 *   2. роль в базе — этому пользователю действительно разрешена админка.
 */
export async function requireAdmin(
  request: VercelRequest,
  db: Firestore,
): Promise<AdminIdentity> {
  const token = extractToken(request);

  let decoded;
  try {
    // checkRevoked: true — если Ксения вышла из аккаунта или его отозвали,
    // старый токен перестаёт действовать сразу, а не через час.
    decoded = await getAdminAuth().verifyIdToken(token, true);
  } catch {
    throw new AdminAuthError('Сессия истекла, войдите заново', 401);
  }

  const profile = await db.collection('users').doc(decoded.uid).get();

  if (!profile.exists || profile.data()?.role !== 'admin') {
    // Намеренно не уточняем, что именно не так: посторонним знать,
    // существует ли учётная запись, незачем.
    throw new AdminAuthError('Доступ запрещён', 403);
  }

  return { uid: decoded.uid, email: decoded.email ?? '' };
}
