/**
 * Первый шаг конструктора — выбор формата изделия (UX-flow, п. 2.2).
 * Крупные карточки с реальными фотографиями десертов Ксении.
 */

import { ChevronRight } from 'lucide-react';
import { formatPrice } from '@/lib/pricing';
import type { DessertCategory, DessertComponent } from '@/types';

interface CategoryPickerProps {
  categories: DessertCategory[];
  components: DessertComponent[];
  onSelect: (category: DessertCategory) => void;
}

/**
 * Минимальная цена категории — «от 550 ₽».
 * Считается по самому дешёвому варианту: для тортов это цена за килограмм,
 * умноженная на минимальный вес, иначе получилось бы «от 2500 ₽» за торт,
 * которого в природе не бывает легче полутора килограммов.
 */
function getStartingPrice(
  category: DessertCategory,
  components: DessertComponent[],
): number | null {
  const variants = components.filter(
    (component) =>
      component.categoryId === category.id &&
      component.type === 'variant' &&
      !component.needsPriceReview &&
      component.inStock,
  );

  if (variants.length === 0) return null;

  const cheapest = Math.min(...variants.map((variant) => variant.price));
  const minimumQuantity = category.quantity.min ?? category.quantity.defaultValue;

  return Math.round(cheapest * minimumQuantity);
}

export function CategoryPicker({ categories, components, onSelect }: CategoryPickerProps) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[20px] leading-[1.3] font-medium tracking-[-0.01em] text-text-primary">
          Что будем собирать?
        </h1>
        <p className="mt-1 text-[14px] text-text-muted">
          Выберите формат — дальше подберём начинку и оформление.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {categories.map((category) => {
          const startingPrice = getStartingPrice(category, components);

          return (
            <button
              key={category.id}
              type="button"
              onClick={() => onSelect(category)}
              className="group flex cursor-pointer items-stretch overflow-hidden rounded-[14px] border border-border bg-surface text-left transition-all duration-200 hover:border-border-active hover:bg-surface-hover"
            >
              <div className="w-[104px] shrink-0 overflow-hidden bg-surface-hover">
                {category.imageUrl ? (
                  <img
                    src={category.imageUrl}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                  />
                ) : null}
              </div>

              <div className="flex flex-1 flex-col justify-center gap-1 p-4">
                <span className="text-[16px] leading-[1.35] font-medium text-text-primary">
                  {category.name}
                </span>
                <span className="line-clamp-2 text-[12px] leading-[1.45] text-text-muted">
                  {category.description}
                </span>
                {startingPrice !== null && (
                  <span className="mt-1 text-[13px] font-medium text-primary">
                    от {formatPrice(startingPrice)}
                  </span>
                )}
              </div>

              <div className="flex items-center pr-3 text-text-muted transition-colors duration-200 group-hover:text-primary">
                <ChevronRight className="h-5 w-5" strokeWidth={1.75} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
