/**
 * Первичное наполнение Firestore каталогом Ксении.
 *
 * Запуск:
 *   npm run seed          — записать только недостающие документы
 *   npm run seed -- --force — перезаписать существующие
 *
 * Скрипт работает от имени сервисного аккаунта в обход Security Rules,
 * поэтому запускается только с машины разработчика.
 *
 * По умолчанию уже существующие документы НЕ трогаются: если Ксения успела
 * поправить цену в админке, повторный запуск скрипта её не затрёт.
 */

import { readFileSync } from 'node:fs';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { CATEGORIES_SEED, COMPONENTS_SEED } from '../src/data/catalog.seed.ts';

const FORCE = process.argv.includes('--force');

function loadServiceAccount() {
  const inline = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (inline) return JSON.parse(inline);

  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (path) return JSON.parse(readFileSync(path, 'utf8'));

  throw new Error(
    'Не найден ключ сервисного аккаунта.\n' +
      'Укажи один из вариантов:\n' +
      '  GOOGLE_SERVICE_ACCOUNT_KEY — содержимое JSON-ключа целиком;\n' +
      '  GOOGLE_APPLICATION_CREDENTIALS — путь к файлу ключа.\n' +
      'Как получить ключ — см. google-sheets-setup.md, шаги 3–4.',
  );
}

/**
 * Проверка каталога перед записью — Crash Early.
 * Дешевле поймать опечатку здесь, чем разбираться, почему у категории
 * в проде не отрисовался шаг.
 */
function validateCatalog() {
  const problems: string[] = [];

  const categoryIds = new Set<string>();
  for (const category of CATEGORIES_SEED) {
    if (categoryIds.has(category.id)) problems.push(`Дубль категории: ${category.id}`);
    categoryIds.add(category.id);

    // Количество задаётся одним из трёх способов: жёстко зафиксировано,
    // перечислено списком либо описано диапазоном с шагом.
    const { presets, min, max, step, isFixed } = category.quantity;
    if (!isFixed && !presets?.length && (min === undefined || max === undefined || !step)) {
      problems.push(`Категория «${category.name}»: не задано правило количества`);
    }
  }

  const componentIds = new Set<string>();
  /** Сколько компонентов каждого типа есть у категории — считаем только доступные клиенту. */
  const countByCategoryStep = new Map<string, number>();
  const key = (categoryId: string, type: string) => `${categoryId}::${type}`;

  for (const item of COMPONENTS_SEED) {
    if (componentIds.has(item.id)) problems.push(`Дубль компонента: ${item.id}`);
    componentIds.add(item.id);

    if (!categoryIds.has(item.categoryId)) {
      problems.push(
        `Компонент «${item.name}» ссылается на несуществующую категорию ${item.categoryId}`,
      );
    }

    if (item.price < 0) problems.push(`Компонент «${item.name}»: отрицательная цена`);
    if (item.type === 'variant' && item.price === 0 && !item.needsPriceReview) {
      problems.push(`Вариант «${item.name}»: нулевая цена без пометки needsPriceReview`);
    }

    // Позиции без подтверждённой цены клиентам не показываются,
    // поэтому в проверке достаточности вариантов они не участвуют.
    if (item.needsPriceReview) continue;
    const mapKey = key(item.categoryId, item.type);
    countByCategoryStep.set(mapKey, (countByCategoryStep.get(mapKey) ?? 0) + 1);
  }

  for (const category of CATEGORIES_SEED) {
    if (!category.steps.some((step) => step.type === 'variant')) {
      problems.push(`Категория «${category.name}»: нет шага variant, цену взять неоткуда`);
    }

    for (const step of category.steps) {
      const available = countByCategoryStep.get(key(category.id, step.type)) ?? 0;

      if (available === 0) {
        problems.push(
          `Категория «${category.name}», шаг «${step.label}»: нет доступных компонентов`,
        );
        continue;
      }

      // Нельзя требовать выбрать три обсыпки, если их заведено две.
      if (available < step.minSelect) {
        problems.push(
          `Категория «${category.name}», шаг «${step.label}»: нужно выбрать ${step.minSelect}, ` +
            `а доступно всего ${available}`,
        );
      }

      if (step.maxSelect < step.minSelect) {
        problems.push(
          `Категория «${category.name}», шаг «${step.label}»: maxSelect меньше minSelect`,
        );
      }
    }
  }

  if (problems.length) {
    throw new Error(`Каталог не прошёл проверку:\n  • ${problems.join('\n  • ')}`);
  }

  console.log(
    `Проверка каталога пройдена: ${CATEGORIES_SEED.length} категорий, ${COMPONENTS_SEED.length} компонентов.`,
  );
}

async function seed() {
  validateCatalog();

  initializeApp({ credential: cert(loadServiceAccount()) });
  const db = getFirestore();

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const [collectionName, documents] of [
    ['categories', CATEGORIES_SEED],
    ['components', COMPONENTS_SEED],
  ] as const) {
    for (const document of documents) {
      const reference = db.collection(collectionName).doc(document.id);
      const snapshot = await reference.get();

      if (snapshot.exists && !FORCE) {
        skipped += 1;
        continue;
      }

      await reference.set(document);
      if (snapshot.exists) updated += 1;
      else created += 1;
    }
  }

  console.log(`Создано:     ${created}`);
  console.log(`Перезаписано: ${updated}`);
  console.log(`Пропущено:   ${skipped}${skipped && !FORCE ? ' (уже существуют)' : ''}`);

  const needReview = COMPONENTS_SEED.filter((component) => component.needsPriceReview);
  if (needReview.length) {
    console.log(`\n⚠️  Позиций без подтверждённой цены: ${needReview.length}`);
    for (const component of needReview) {
      console.log(`   • ${component.name} (${component.categoryId})`);
    }
    console.log('   Они скрыты от клиентов, пока Ксения не проставит стоимость в админке.');
  }
}

seed().catch((error: unknown) => {
  console.error('\nЗасев не выполнен:');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
