/**
 * Инициализация Firebase.
 *
 * Принцип Crash Early с оговоркой: на Stage 1 каталог ещё не подключён, поэтому
 * отсутствие конфига не должно ронять стартовый экран. Вместо падения выставляем
 * флаг isFirebaseConfigured и пишем внятное предупреждение в консоль — экраны,
 * которым нужны данные, сами покажут корректное состояние ошибки.
 */

import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { getAuth, type Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/** Конфиг считается валидным, только если заполнены все обязательные поля. */
export const isFirebaseConfigured: boolean = Object.values(firebaseConfig).every(
  (value) => typeof value === 'string' && value.length > 0,
);

let app: FirebaseApp | null = null;
let firestore: Firestore | null = null;
let storage: FirebaseStorage | null = null;
let auth: Auth | null = null;

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  firestore = getFirestore(app);
  storage = getStorage(app);
  auth = getAuth(app);
} else {
  console.warn(
    '[Candy_Ksendy] Firebase не настроен: заполни переменные VITE_FIREBASE_* в файле .env ' +
      '(шаблон — .env.example). Стартовый экран работает без него, каталог и заказы — нет.',
  );
}

/**
 * Доступ к Firestore для экранов, которым база обязательна.
 * Бросает исключение вместо тихой работы с null — ошибку видно сразу.
 */
export function requireFirestore(): Firestore {
  if (!firestore) {
    throw new Error(
      'Firestore недоступен: Firebase не сконфигурирован. Проверь переменные VITE_FIREBASE_* в .env',
    );
  }
  return firestore;
}

export function requireStorage(): FirebaseStorage {
  if (!storage) {
    throw new Error(
      'Firebase Storage недоступен: Firebase не сконфигурирован. Проверь переменные VITE_FIREBASE_* в .env',
    );
  }
  return storage;
}

export function requireAuth(): Auth {
  if (!auth) {
    throw new Error(
      'Firebase Auth недоступен: Firebase не сконфигурирован. Проверь переменные VITE_FIREBASE_* в .env',
    );
  }
  return auth;
}

export { app, firestore, storage, auth };
