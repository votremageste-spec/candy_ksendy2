/**
 * Карточка ингредиента в конструкторе.
 * Стайл-гайд, п. 5.2 — четыре состояния и ни одной тени.
 *
 *  Default      — белая карточка, граница 1px, скругление 10px.
 *  Hover        — фон сливочной помадки, граница подсвечивается.
 *  Selected     — граница 2px малинового цвета и круглый бадж с галочкой.
 *  Out of stock — матовая вуаль, надпись «Закончился», клик заблокирован.
 */

import { Check, CakeSlice } from 'lucide-react';
import type { DessertComponent } from '@/types';

interface ComponentCardProps {
  component: DessertComponent;
  isSelected: boolean;
  /** Готовая подпись цены: «2 500 ₽/кг», «+ 200 ₽» или «Входит в стоимость». */
  priceLabel: string;
  onSelect: (component: DessertComponent) => void;
}

export function ComponentCard({
  component,
  isSelected,
  priceLabel,
  onSelect,
}: ComponentCardProps) {
  const isBlocked = !component.inStock;

  const borderClass = isSelected
    ? 'border-2 border-primary'
    : isBlocked
      ? 'border border-border'
      : 'border border-border hover:border-border-active hover:bg-surface-hover';

  return (
    <button
      type="button"
      disabled={isBlocked}
      onClick={() => onSelect(component)}
      aria-pressed={isSelected}
      aria-label={`${component.name}. ${priceLabel}${isBlocked ? '. Закончился' : ''}`}
      className={`group relative flex flex-col overflow-hidden rounded-[10px] bg-surface text-left transition-all duration-200 ${borderClass} ${
        isBlocked ? 'cursor-not-allowed' : 'cursor-pointer'
      }`}
    >
      {/* Фотография занимает верхние 65% карточки */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-hover">
        {component.imageUrl ? (
          <img
            src={component.imageUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          // Фотографии пока нет — показываем спокойную заглушку,
          // а не битую картинку и не пустоту.
          <div className="flex h-full w-full items-center justify-center">
            <CakeSlice className="h-7 w-7 text-border-active" strokeWidth={1.25} />
          </div>
        )}

        {isSelected && (
          <span className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary">
            <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <span className="text-[15px] leading-[1.35] font-medium text-text-primary">
          {component.name}
        </span>

        {component.description && (
          <span className="line-clamp-2 text-[12px] leading-[1.45] text-text-muted">
            {component.description}
          </span>
        )}

        <span className="mt-auto pt-1 text-[13px] font-medium text-primary">{priceLabel}</span>
      </div>

      {isBlocked && (
        <span className="absolute inset-0 flex items-center justify-center bg-surface/70">
          <span className="rounded-[6px] border border-border bg-surface px-3 py-1.5 text-[13px] text-text-muted">
            Закончился
          </span>
        </span>
      )}
    </button>
  );
}
