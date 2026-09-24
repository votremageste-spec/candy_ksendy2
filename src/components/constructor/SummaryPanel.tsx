/**
 * Превью собранного десерта и калькулятор стоимости.
 *
 * На десктопе занимает правые 60% экрана и не прокручивается (стайл-гайд, п. 6.1).
 * На мобильном та же начинка выводится компактной плашкой над кнопкой заказа.
 *
 * Послойного наложения ингредиентов на фото, как описано в стайл-гайде, нет:
 * для него нужны PNG с прозрачностью, которых не существует. Вместо этого —
 * крупное фото категории и подробный список выбранного (см. ASSUMPTIONS.md).
 */

import { formatPrice, formatQuantity } from '@/lib/pricing';
import type { PriceBreakdown } from '@/lib/pricing';
import type { ConstructorStep, DessertCategory, StepSelection } from '@/types';

interface SummaryPanelProps {
  category: DessertCategory;
  steps: ConstructorStep[];
  selection: StepSelection;
  quantity: number | null;
  breakdown: PriceBreakdown;
  /** Компактный вид для мобильной плашки: без фотографии и с плотными отступами. */
  isCompact?: boolean;
}

export function SummaryPanel({
  category,
  steps,
  selection,
  quantity,
  breakdown,
  isCompact = false,
}: SummaryPanelProps) {
  const rows = steps
    .map((step) => ({
      label: step.label,
      value: (selection[step.type] ?? []).map((component) => component.name).join(', '),
    }))
    .filter((row) => row.value.length > 0);

  return (
    <div
      className={
        isCompact
          ? 'rounded-[10px] border border-border bg-surface p-3'
          : 'overflow-hidden rounded-[14px] border border-border bg-surface'
      }
    >
      {!isCompact && category.imageUrl && (
        <div className="aspect-[4/3] w-full overflow-hidden bg-surface-hover">
          <img src={category.imageUrl} alt="" className="h-full w-full object-cover" />
        </div>
      )}

      <div className={isCompact ? '' : 'p-5'}>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[15px] font-medium text-text-primary">{category.shortName}</span>
          {quantity !== null && (
            <span className="text-[13px] text-text-muted">
              {formatQuantity(quantity, category.quantity.unitLabel)}
            </span>
          )}
        </div>

        {rows.length > 0 ? (
          <dl className={`flex flex-col gap-2 ${isCompact ? 'mt-2' : 'mt-4'}`}>
            {rows.map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-4">
                <dt className="shrink-0 text-[13px] text-text-muted">{row.label}</dt>
                <dd className="text-right text-[13px] text-text-primary">{row.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className={`text-[13px] text-text-muted ${isCompact ? 'mt-2' : 'mt-4'}`}>
            Пока ничего не выбрано — начните с первого шага.
          </p>
        )}

        {breakdown.additions.length > 0 && (
          <dl className="mt-2 flex flex-col gap-1 border-t border-border pt-2">
            {breakdown.additions.map((addition) => (
              <div key={addition.name} className="flex items-baseline justify-between gap-4">
                <dt className="text-[12px] text-text-muted">{addition.name}</dt>
                <dd className="text-[12px] text-text-muted">+ {formatPrice(addition.price)}</dd>
              </div>
            ))}
          </dl>
        )}

        <div
          className={`flex items-baseline justify-between border-t border-border ${
            isCompact ? 'mt-3 pt-3' : 'mt-5 pt-5'
          }`}
        >
          <span className="text-[14px] text-text-muted">Итого</span>
          <span className="text-[20px] leading-none font-medium tracking-[-0.01em] text-text-primary">
            {breakdown.total > 0 ? formatPrice(breakdown.total) : '—'}
          </span>
        </div>
      </div>
    </div>
  );
}
