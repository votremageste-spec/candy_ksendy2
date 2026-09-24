/**
 * Firebase Admin SDK для серверных функций Vercel.
 *
 * Admin SDK работает в обход Security Rules по сервисному ключу — именно
 * поэтому коллекция `orders` закрыта для браузера наглухо: писать в неё
 * может только этот код.
 *
 * Инициализация выполняется один раз на «тёплый» инстанс функции: между
 * вызовами Vercel переиспользует процесс, и повторный initializeApp упал бы
 * с ошибкой.
 */

import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';

let cached: Firestore | null = null;
let cachedAuth: Auth | null = null;

/** Приватный ключ в переменных окружения хранится с экранированными переводами строк. */
function readPrivateKey(): string {
  const key = process.env.FIREBASE_PRIVATE_KEY;
  if (!key) {
    throw new Error('Не задана переменная окружения FIREBASE_PRIVATE_KEY');
  }
  return key.replace(/\\n/g, '\n');
}

export function getDb(): Firestore {
  if (cached) return cached;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (!projectId || !clientEmail) {
    throw new Error(
      'Не заданы переменные окружения FIREBASE_PROJECT_ID и FIREBASE_CLIENT_EMAIL',
    );
  }

  const existing: App | undefined = getApps()[0];
  const app =
    existing ??
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey: readPrivateKey() }),
    });

  cached = getFirestore(app);
  return cached;
}

/**
 * Firebase Auth на сервере — нужен, чтобы проверять подпись токена,
 * который админка присылает вместе с запросом.
 */
export function getAdminAuth(): Auth {
  if (cachedAuth) return cachedAuth;

  // Приложение инициализируется тем же кодом, что и для базы.
  getDb();
  cachedAuth = getAuth(getApps()[0]);
  return cachedAuth;
}
