/**
 * Выдача прав администратора.
 *
 * Запуск:
 *   npm run grant-admin -- ksenia@example.com [ещё@почта]
 *   npm run grant-admin -- --list          показать текущих администраторов
 *   npm run grant-admin -- --revoke почта  отобрать доступ
 *
 * Тонкость, из-за которой скрипт вообще нужен: правила проверяют документ
 * `users/{uid}`, а UID появляется только после первого входа. Получается
 * замкнутый круг — войти нельзя, потому что нет прав, а прав нет, потому что
 * не входил.
 *
 * Круг разрывается созданием учётной записи заранее по адресу почты. Когда
 * человек потом войдёт через Google с тем же адресом, Firebase свяжет вход
 * с уже существующей записью и UID не изменится. Это поведение по умолчанию
 * (настройка «один аккаунт на адрес электронной почты»); если её отключить,
 * связывания не произойдёт и права придётся выдавать после первого входа.
 */

import { readFileSync } from 'node:fs';
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function loadServiceAccount() {
  const inline = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (inline) return JSON.parse(inline);

  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (path) return JSON.parse(readFileSync(path, 'utf8'));

  throw new Error(
    'Не найден ключ сервисного аккаунта.\n' +
      'Укажи GOOGLE_SERVICE_ACCOUNT_KEY (содержимое JSON) либо\n' +
      'GOOGLE_APPLICATION_CREDENTIALS (путь к файлу ключа).',
  );
}

initializeApp({ credential: cert(loadServiceAccount()) });
const auth = getAuth();
const db = getFirestore();

/** Находит учётную запись по почте или создаёт её, если человек ещё не входил. */
async function resolveUid(email: string): Promise<{ uid: string; wasCreated: boolean }> {
  try {
    const existing = await auth.getUserByEmail(email);
    return { uid: existing.uid, wasCreated: false };
  } catch (error) {
    if ((error as { code?: string }).code !== 'auth/user-not-found') throw error;

    const created = await auth.createUser({ email, emailVerified: false });
    return { uid: created.uid, wasCreated: true };
  }
}

async function grant(email: string): Promise<void> {
  const { uid, wasCreated } = await resolveUid(email);

  await db.collection('users').doc(uid).set(
    {
      email,
      role: 'admin',
      grantedAt: new Date().toISOString(),
    },
    { merge: true },
  );

  console.log(`  ✓ ${email}`);
  console.log(`      uid: ${uid}`);
  if (wasCreated) {
    console.log('      учётная запись создана заранее — при первом входе через');
    console.log('      Google она свяжется с этим же UID');
  }
}

async function revoke(email: string): Promise<void> {
  const user = await auth.getUserByEmail(email).catch(() => null);
  if (!user) {
    console.log(`  — ${email}: учётная запись не найдена`);
    return;
  }

  await db.collection('users').doc(user.uid).delete();
  console.log(`  ✓ Доступ отозван: ${email}`);
}

async function list(): Promise<void> {
  const snapshot = await db.collection('users').where('role', '==', 'admin').get();

  if (snapshot.empty) {
    console.log('  Администраторов нет. В кабинет не войдёт никто.');
    return;
  }

  console.log(`  Администраторов: ${snapshot.size}`);
  for (const document of snapshot.docs) {
    const data = document.data();
    console.log(`    • ${data.email ?? '(почта не записана)'}  —  ${document.id}`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--list')) {
    await list();
    return;
  }

  const revokeIndex = args.indexOf('--revoke');
  if (revokeIndex !== -1) {
    const email = args[revokeIndex + 1];
    if (!email) throw new Error('После --revoke нужно указать адрес почты');
    await revoke(email);
    return;
  }

  const emails = args.filter((value) => value.includes('@'));
  if (emails.length === 0) {
    throw new Error(
      'Укажи хотя бы один адрес почты.\n' +
        'Пример: npm run grant-admin -- ksenia@example.com',
    );
  }

  console.log('Выдаю права администратора:');
  for (const email of emails) {
    await grant(email);
  }

  console.log('');
  await list();
}

main().catch((error: unknown) => {
  console.error('\nНе выполнено:');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
