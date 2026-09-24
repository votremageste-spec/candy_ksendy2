/**
 * Логика выбора компонентов на шаге конструктора.
 *
 * Вынесена отдельно от калькулятора: правила «сколько можно выбрать» одинаковы
 * для всех категорий и задаются данными (ConstructorStep.minSelect/maxSelect),
 * а не условиями в коде экрана.
 */

import type { ConstructorStep, DessertComponent, StepSelection } from '@/types';

/**
 * Переключает компонент на шаге.
 *
 * Поведение зависит от maxSelect:
 *  • maxSelect === 1 — обычный выбор: новый компонент заменяет прежний;
 *    повторный клик по уже выбранному снимает выбор, только если шаг
 *    необязательный (декор), иначе выбор сохраняется;
 *  • maxSelect > 1 — множественный выбор: клик добавляет или убирает.
 *    При достижении лимита самый ранний выбор вытесняется новым, чтобы
 *    пользователю не приходилось сначала что-то снимать.
 */
export function toggleComponent(
  selection: StepSelection,
  step: ConstructorStep,
  component: DessertComponent,
): StepSelection {
  const current = selection[step.type] ?? [];
  const isSelected = current.some((item) => item.id === component.id);

  if (step.maxSelect === 1) {
    // Снять выбор можно только на необязательном шаге.
    if (isSelected) {
      return step.minSelect === 0 ? { ...selection, [step.type]: [] } : selection;
    }
    return { ...selection, [step.type]: [component] };
  }

  if (isSelected) {
    const next = current.filter((item) => item.id !== component.id);
    return { ...selection, [step.type]: next };
  }

  // Лимит исчерпан — вытесняем самый ранний выбор.
  const next =
    current.length >= step.maxSelect
      ? [...current.slice(current.length - step.maxSelect + 1), component]
      : [...current, component];

  return { ...selection, [step.type]: next };
}

/** Выбран ли конкретный компонент на шаге. */
export function isComponentSelected(
  selection: StepSelection,
  step: ConstructorStep,
  componentId: string,
): boolean {
  return (selection[step.type] ?? []).some((item) => item.id === componentId);
}

/** Пройден ли шаг: выбрано не меньше требуемого минимума. */
export function isStepComplete(selection: StepSelection, step: ConstructorStep): boolean {
  return (selection[step.type]?.length ?? 0) >= step.minSelect;
}

/**
 * Подсказка о состоянии множественного выбора: «Выбрано 2 из 3».
 * Для шагов с выбором одного возвращает пустую строку — там это лишний шум.
 */
export function getSelectionHint(selection: StepSelection, step: ConstructorStep): string {
  if (step.maxSelect === 1) return '';
  const count = selection[step.type]?.length ?? 0;
  return `Выбрано ${count} из ${step.maxSelect}`;
}

/**
 * Компоненты, доступные клиенту: в наличии и с подтверждённой ценой.
 * Позиции с needsPriceReview скрыты до тех пор, пока Ксения не проставит
 * стоимость в админке.
 */
export function getAvailableComponents(components: DessertComponent[]): DessertComponent[] {
  return components
    .filter((component) => !component.needsPriceReview)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}
