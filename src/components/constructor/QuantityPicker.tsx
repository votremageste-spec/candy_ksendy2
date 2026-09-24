/**
 * Шаг выбора веса или количества.
 *
 * Одна и та же вёрстка обслуживает три случая, потому что различаются они
 * только правилом из данных:
 *  • торты  — 1,5…5 кг с шагом 0,5;
 *  • моти   — 4…12 штук;
 *  • бенто  — количество зафиксировано, выбор не показывается вовсе.
 */

import { formatPrice, formatQuantity, getQuantityOptions } from '@/lib/pricing';
import type { DessertCategory } from '@/types';

interface QuantityPickerProps {
  category: DessertCategory;
  value: number | null;
  /** Цена за единицу выбранного варианта. Нужна, чтобы показать сумму на кнопке. */
  unitPrice: number | null;
  onChange: (quantity: number) => void;
}

export function QuantityPicker({ category, value, unitPrice, onChange }: QuantityPickerProps) {
  const { quantity } = category;

  if (quantity.isFixed) {
    return (
      <div className="rounded-[10px] border border-border bg-surface px-4 py-5 text-center">
        <p className="text-[15px] text-text-primary">
          {formatQuantity(quantity.defaultValue, quantity.unitLabel)}
        </p>
        <p className="mt-1 text-[12px] text-text-muted">
          Для этой позиции количество фиксированное
        </p>
      </div>
    );
  }

  const options = getQuantityOptions(quantity);

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {options.map((option) => {
        const isActive = value === option;
        const total = unitPrice !== null ? Math.round(unitPrice * option) : null;

        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            aria-pressed={isActive}
            className={`flex cursor-pointer flex-col items-center gap-0.5 rounded-[10px] border px-2 py-3 transition-all duration-200 ${
              isActive
                ? 'border-2 border-primary bg-surface'
                : 'border border-border bg-surface hover:border-border-active hover:bg-surface-hover'
            }`}
          >
            <span className="text-[15px] font-medium text-text-primary">
              {option.toLocaleString('ru-RU')}
              <span className="ml-1 text-[12px] font-normal text-text-muted">
                {quantity.unitLabel}
              </span>
            </span>
            {total !== null && (
              <span className="text-[12px] text-text-muted">{formatPrice(total)}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
