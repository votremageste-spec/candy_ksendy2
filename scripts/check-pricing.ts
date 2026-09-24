/**
 * Проверка калькулятора на реальных данных каталога.
 *
 * Запуск: npm run check
 *
 * Ожидаемые суммы взяты не из головы, а из постов канала: Ксения сама
 * публиковала цену наборов моти (4 шт — 680 ₽, 6 шт — 1020 ₽), и расчёт
 * обязан совпадать с ней до рубля.
 */

import { CATEGORIES_SEED, COMPONENTS_SEED } from '../src/data/catalog.seed.ts';
import { calculatePrice } from '../src/lib/pricing.ts';
import { toggleComponent } from '../src/lib/selection.ts';
import {
  formatPhone,
  getEarliestPickup,
  normalizePhone,
  toDateTimeLocalValue,
  validateCheckout,
  type CheckoutFields,
} from '../src/lib/validation.ts';
import type { ConstructorState, StepSelection } from '../src/types/index.ts';

const category = (id: string) => {
  const found = CATEGORIES_SEED.find((item) => item.id === id);
  if (!found) throw new Error(`Категория ${id} не найдена`);
  return found;
};

const component = (id: string) => {
  const found = COMPONENTS_SEED.find((item) => item.id === id);
  if (!found) throw new Error(`Компонент ${id} не найден`);
  return found;
};

/** Собирает состояние конструктора через ту же логику, что и интерфейс. */
function build(categoryId: string, componentIds: string[], quantity: number): ConstructorState {
  const target = category(categoryId);
  let selection: StepSelection = {};

  for (const componentId of componentIds) {
    const item = component(componentId);
    const step = target.steps.find((candidate) => candidate.type === item.type);
    if (!step) throw new Error(`У категории ${categoryId} нет шага ${item.type}`);
    selection = toggleComponent(selection, step, item);
  }

  return { category: target, selection, quantity, inscription: '' };
}

interface Case {
  name: string;
  state: ConstructorState;
  expectedTotal: number;
  expectedComplete: boolean;
}

const cases: Case[] = [
  {
    name: 'Торт «Чёрный лес», 2 кг — 2500 ₽/кг',
    state: build('cakes', ['cake-black-forest'], 2),
    expectedTotal: 5000,
    expectedComplete: true,
  },
  {
    name: 'Торт «Шоколадный трюфель», 1,5 кг',
    state: build('cakes', ['cake-chocolate-truffle'], 1.5),
    expectedTotal: 3750,
    expectedComplete: true,
  },
  {
    name: 'Бенто «Ваниль-клубника», 1 шт',
    state: build('bento', ['bento-vanilla-strawberry'], 1),
    expectedTotal: 1500,
    expectedComplete: true,
  },
  {
    name: 'Моти «Тирамису», 4 шт — канал заявляет 680 ₽',
    state: build('mochi', ['mochi-tiramisu', 'mochi-dough-classic'], 4),
    expectedTotal: 680,
    expectedComplete: true,
  },
  {
    name: 'Моти «Тирамису», 6 шт — канал заявляет 1020 ₽',
    state: build('mochi', ['mochi-tiramisu', 'mochi-dough-classic'], 6),
    expectedTotal: 1020,
    expectedComplete: true,
  },
  {
    name: 'Моти без выбранного теста — шаг не пройден',
    state: build('mochi', ['mochi-tiramisu'], 6),
    expectedTotal: 1020,
    expectedComplete: false,
  },
  {
    name: 'Зефир, 1 набор',
    state: build('marshmallow', ['marshmallow-set-6', 'marshmallow-flavor-strawberry'], 1),
    expectedTotal: 700,
    expectedComplete: true,
  },
  {
    name: 'Птичье молоко: две обсыпки из трёх — шаг не пройден',
    state: build(
      'birds-milk',
      ['birds-milk-set-9', 'birds-milk-topping-cocoa', 'birds-milk-topping-coconut'],
      1,
    ),
    expectedTotal: 550,
    expectedComplete: false,
  },
  {
    name: 'Птичье молоко: три обсыпки — шаг пройден',
    state: build(
      'birds-milk',
      [
        'birds-milk-set-9',
        'birds-milk-topping-cocoa',
        'birds-milk-topping-coconut',
        'birds-milk-topping-strawberry',
      ],
      1,
    ),
    expectedTotal: 550,
    expectedComplete: true,
  },
  {
    name: 'Царский кулич, 3 шт — 950 ₽ по ТЗ v4',
    state: build('kulich', ['kulich-tsar'], 3),
    expectedTotal: 2850,
    expectedComplete: true,
  },
  {
    name: 'Торт 2 кг + ягодный декор — 5000 + 500',
    state: build('cakes', ['cake-black-forest', 'cake-decor-berries'], 2),
    expectedTotal: 5500,
    expectedComplete: true,
  },
  {
    name: 'Торт 3 кг + сложный декор — 7500 + 1000',
    state: build('cakes', ['cake-chocolate-truffle', 'cake-decor-complex'], 3),
    expectedTotal: 8500,
    expectedComplete: true,
  },
  {
    name: 'Бенто + сложный декор — 1500 + 300',
    state: build('bento', ['bento-vanilla-cherry', 'bento-decor-complex'], 1),
    expectedTotal: 1800,
    expectedComplete: true,
  },
  {
    name: 'Базовое оформление торта ничего не добавляет',
    state: build('cakes', ['cake-black-forest', 'cake-decor-base'], 2),
    expectedTotal: 5000,
    expectedComplete: true,
  },
  {
    name: 'Без выбранной начинки цена не считается',
    state: build('cakes', [], 2),
    expectedTotal: 0,
    expectedComplete: false,
  },
];

let failed = 0;

for (const testCase of cases) {
  const result = calculatePrice(testCase.state);
  const totalOk = result.total === testCase.expectedTotal;
  const completeOk = result.isComplete === testCase.expectedComplete;

  if (totalOk && completeOk) {
    console.log(`  ✓ ${testCase.name} → ${result.total} ₽`);
    continue;
  }

  failed += 1;
  console.log(`  ✗ ${testCase.name}`);
  if (!totalOk) console.log(`      сумма: ожидалось ${testCase.expectedTotal}, получено ${result.total}`);
  if (!completeOk)
    console.log(
      `      готовность: ожидалось ${testCase.expectedComplete}, получено ${result.isComplete}`,
    );
}

/** Отдельная проверка: лимит множественного выбора не превышается. */
const birdsMilk = category('birds-milk');
const toppingStep = birdsMilk.steps.find((step) => step.type === 'topping')!;
let selection: StepSelection = {};
for (const id of [
  'birds-milk-topping-cocoa',
  'birds-milk-topping-coconut',
  'birds-milk-topping-strawberry',
  'birds-milk-topping-pistachio',
]) {
  selection = toggleComponent(selection, toppingStep, component(id));
}
const toppingCount = selection.topping?.length ?? 0;
if (toppingCount === 3) {
  console.log('  ✓ Четвёртая обсыпка вытесняет первую, лимит держится на трёх');
} else {
  failed += 1;
  console.log(`  ✗ Лимит обсыпок нарушен: выбрано ${toppingCount}, ожидалось 3`);
}

/* ─────────────────── Проверка правил формы заявки ─────────────────── */

console.log('\n  Валидация формы:');

const validBase = {
  name: 'Александра',
  phone: '+7 (999) 123-45-67',
  telegram: '@alexandra_p',
  pickupAt: toDateTimeLocalValue(new Date(getEarliestPickup().getTime() + 60 * 60 * 1000)),
  comment: '',
  consent: true,
};

function expectField(label: string, fields: CheckoutFields, field: keyof CheckoutFields | null) {
  const errors = validateCheckout(fields);
  const actual = Object.keys(errors)[0] ?? null;
  const expected = field;

  if ((expected === null && actual === null) || (expected !== null && field! in errors)) {
    console.log(`  ✓ ${label}`);
    return;
  }

  failed += 1;
  console.log(`  ✗ ${label}: ожидалась ошибка «${expected ?? 'нет'}», получено «${actual ?? 'нет'}»`);
}

expectField('Корректная форма проходит', validBase, null);
expectField('Имя из одной буквы отклоняется', { ...validBase, name: 'А' }, 'name');
expectField('Цифры в имени отклоняются', { ...validBase, name: 'Аня123' }, 'name');
expectField('Короткий телефон отклоняется', { ...validBase, phone: '+7 999' }, 'phone');
expectField('Пустой телефон отклоняется', { ...validBase, phone: '' }, 'phone');
expectField('Без согласия заявка не принимается', { ...validBase, consent: false }, 'consent');
expectField(
  'Дата раньше 48 часов отклоняется',
  { ...validBase, pickupAt: toDateTimeLocalValue(new Date(Date.now() + 3 * 60 * 60 * 1000)) },
  'pickupAt',
);
expectField('Пустой Telegram допустим', { ...validBase, telegram: '' }, null);
expectField('Короткий ник Telegram отклоняется', { ...validBase, telegram: '@ab' }, 'telegram');

// Телефон в разных записях должен приводиться к одному виду.
const phoneVariants = ['89991234567', '+7 (999) 123-45-67', '9991234567', '7 999 123 45 67'];
const normalized = new Set(phoneVariants.map(normalizePhone));
if (normalized.size === 1 && normalized.has('79991234567')) {
  console.log('  ✓ Телефон приводится к единому виду из четырёх записей');
} else {
  failed += 1;
  console.log(`  ✗ Нормализация телефона расходится: ${[...normalized].join(', ')}`);
}

if (formatPhone('89991234567') === '+7 (999) 123-45-67') {
  console.log('  ✓ Маска телефона собирается верно');
} else {
  failed += 1;
  console.log(`  ✗ Маска телефона: получено «${formatPhone('89991234567')}»`);
}

console.log(failed === 0 ? '\nВсе проверки пройдены.' : `\nПровалено проверок: ${failed}`);
process.exitCode = failed === 0 ? 0 : 1;
