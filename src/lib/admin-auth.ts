/**
 * Вход в админку через Google-аккаунт.
 *
 * Роль проверяется дважды и в разных местах, и это не перестраховка:
 *   — здесь, чтобы показать понятный экран вместо пустой таблицы;
 *   — в правилах Firestore и в серверных маршрутах, где это уже настоящая
 *     защита. Клиентскую проверку обойти легко, серверную — нет.
 */

import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { requireAuth, requireFirestore } from '@/lib/firebase';

/** Что известно о вошедшем человеке. */
export interface AdminSession {
  user: User;
  isAdmin: boolean;
}

const provider = new GoogleAuthProvider();
// Каждый раз спрашиваем, каким аккаунтом входить: у Ксении и разработчика
// разные почты, а браузер обычно молча подставляет последний.
provider.setCustomParameters({ prompt: 'select_account' });

/** Открывает окно входа Google. Возвращает пользователя либо бросает ошибку. */
export async function signInWithGoogle(): Promise<User> {
  const credential = await signInWithPopup(requireAuth(), provider);
  return credential.user;
}

export async function signOutAdmin(): Promise<void> {
  await signOut(requireAuth());
}

/**
 * Проверяет, есть ли у пользователя роль администратора.
 *
 * Правила разрешают читать только собственный документ `users/{uid}`,
 * поэтому отказ в доступе здесь — это тоже ответ «не администратор»,
 * а не сбой.
 */
export async function checkIsAdmin(user: User): Promise<boolean> {
  try {
    const snapshot = await getDoc(doc(requireFirestore(), 'users', user.uid));
    return snapshot.exists() && snapshot.data()?.role === 'admin';
  } catch {
    return false;
  }
}

/** Подписка на состояние входа. Возвращает функцию отписки. */
export function subscribeToAuth(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(requireAuth(), callback);
}

/**
 * Свежий ID-токен для запросов к серверным маршрутам.
 * Firebase сам обновляет его по истечении часа — принудительное обновление
 * не нужно и лишний раз дёргает сеть.
 */
export async function getIdToken(): Promise<string> {
  const user = requireAuth().currentUser;
  if (!user) {
    throw new Error('Требуется вход');
  }
  return user.getIdToken();
}

/** Человекочитаемое объяснение сбоя входа. */
export function describeAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';

  const messages: Record<string, string> = {
    'auth/popup-closed-by-user': 'Окно входа закрыто. Попробуйте ещё раз',
    'auth/cancelled-popup-request': 'Окно входа закрыто. Попробуйте ещё раз',
    'auth/popup-blocked': 'Браузер заблокировал окно входа. Разрешите всплывающие окна',
    'auth/network-request-failed': 'Нет связи с сервером. Проверьте подключение',
    'auth/unauthorized-domain': 'Домен не разрешён в настройках Firebase Authentication',
    'auth/operation-not-allowed': 'Вход через Google не включён в консоли Firebase',
  };

  return messages[code] ?? 'Не удалось войти. Попробуйте ещё раз';
}
