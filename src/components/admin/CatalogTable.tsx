/**
 * Вкладка «Каталог» в админке.
 *
 * Позиции сгруппированы по категориям, у каждой — тумблер наличия и поле
 * цены. Правка уходит в Firestore сразу, без кнопки «Сохранить»: у клиентов
 * конструктор подписан на базу, и изменение видно им в ту же секунду.
 *
 * Цена подтверждается по Enter или по уходу фокуса, а не на каждое нажатие
 * клавиши — иначе при вводе «1500» в базу успело бы улететь «1», «15», «150».
 */

import { useMemo, useState } from 'react';
import { Search, TriangleAlert } from 'lucide-react';
import { formatPrice } from '@/lib/pricing';
import { setCategoryActive, setComponentPrice, setComponentStock } from '@/lib/adminCatalog';
import { STEP_LABELS } from '@/lib/pricing';
import type { DessertCategory, DessertComponent } from '@/types';

interface CatalogTableProps {
  categories: DessertCategory[];
  components: DessertComponent[];
  onError: (message: string) => void;
}

/** Тумблер в стиле проекта: без теней, на границах и заливке. */
function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-colors duration-200 ${
        checked ? 'border-primary bg-primary' : 'border-border bg-surface-hover'
      }`}
    >
      <span
        className={`absolute top-[2px] h-[18px] w-[18px] rounded-full bg-surface transition-transform duration-200 ${
          checked ? 'translate-x-[22px]' : 'translate-x-[2px]'
        }`}
      />
    </button>
  );
}

/** Строка одной позиции каталога. */
function ComponentRow({
  component,
  unitLabel,
  onError,
}: {
  component: DessertComponent;
  unitLabel: string;
  onError: (message: string) => void;
}) {
  const [draftPrice, setDraftPrice] = useState(String(component.price));
  const [isSaving, setIsSaving] = useState(false);

  // Пока поле не редактируется, показываем значение из базы: так правка
  // Ксении со второго устройства не остаётся незамеченной.
  const [isEditing, setIsEditing] = useState(false);
  const shownPrice = isEditing ? draftPrice : String(component.price);

  const commitPrice = async () => {
    setIsEditing(false);

    const parsed = Number(draftPrice.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < 0) {
      setDraftPrice(String(component.price));
      onError('Цена должна быть неотрицательным числом');
      return;
    }

    if (Math.round(parsed) === component.price) return;

    setIsSaving(true);
    try {
      await setComponentPrice(component.id, parsed);
    } catch (error) {
      setDraftPrice(String(component.price));
      onError(error instanceof Error ? error.message : 'Не удалось сохранить цену');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleStock = async (value: boolean) => {
    setIsSaving(true);
    try {
      await setComponentStock(component.id, value);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Не удалось изменить наличие');
    } finally {
      setIsSaving(false);
    }
  };

  const isVariant = component.type === 'variant';

  return (
    <div
      className={`flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 ${
        component.inStock ? '' : 'opacity-55'
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[14px] font-medium text-text-primary">{component.name}</span>

          <span className="rounded-[6px] border border-border px-1.5 py-0.5 text-[11px] text-text-muted">
            {STEP_LABELS[component.type]}
          </span>

          {component.needsPriceReview && (
            <span className="flex items-center gap-1 rounded-[6px] border border-primary/40 px-1.5 py-0.5 text-[11px] text-primary">
              <TriangleAlert className="h-3 w-3" strokeWidth={2} />
              цена не задана
            </span>
          )}
        </div>

        {component.description && (
          <p className="mt-0.5 line-clamp-1 text-[12px] text-text-muted">{component.description}</p>
        )}
      </div>

      <label className="flex shrink-0 items-center gap-1">
        <input
          type="text"
          inputMode="decimal"
          value={shownPrice}
          disabled={isSaving}
          onFocus={() => {
            setIsEditing(true);
            setDraftPrice(String(component.price));
          }}
          onChange={(event) => setDraftPrice(event.target.value)}
          onBlur={commitPrice}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') {
              setDraftPrice(String(component.price));
              setIsEditing(false);
              event.currentTarget.blur();
            }
          }}
          aria-label={`Цена: ${component.name}`}
          className="w-[86px] rounded-[6px] border border-border bg-background px-2 py-1.5 text-right text-[14px] text-text-primary transition-colors duration-200 outline-none focus:border-primary disabled:opacity-50"
        />
        <span className="w-[34px] text-[12px] text-text-muted">
          ₽{isVariant ? `/${unitLabel}` : ''}
        </span>
      </label>

      <Toggle
        checked={component.inStock}
        onChange={toggleStock}
        label={`В наличии: ${component.name}`}
      />
    </div>
  );
}

export function CatalogTable({ categories, components, onError }: CatalogTableProps) {
  const [query, setQuery] = useState('');

  const normalizedQuery = query.trim().toLowerCase();

  const grouped = useMemo(() => {
    return [...categories]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((category) => ({
        category,
        items: components
          .filter((component) => component.categoryId === category.id)
          .filter(
            (component) =>
              normalizedQuery.length === 0 ||
              component.name.toLowerCase().includes(normalizedQuery) ||
              category.name.toLowerCase().includes(normalizedQuery),
          )
          .sort((a, b) => a.sortOrder - b.sortOrder),
      }))
      .filter((group) => group.items.length > 0);
  }, [categories, components, normalizedQuery]);

  const total = components.length;
  const outOfStock = components.filter((component) => !component.inStock).length;
  const needReview = components.filter((component) => component.needsPriceReview).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-text-muted">
          Всего позиций: {total} · закончилось: {outOfStock}
          {needReview > 0 && ` · без цены: ${needReview}`}
        </p>

        <label className="relative w-full max-w-[280px]">
          <Search
            className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-muted"
            strokeWidth={1.75}
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по названию"
            aria-label="Поиск по каталогу"
            className="w-full rounded-[10px] border border-border bg-surface py-2 pr-3 pl-9 text-[14px] text-text-primary transition-colors duration-200 outline-none placeholder:text-text-muted/70 focus:border-border-active"
          />
        </label>
      </div>

      {grouped.length === 0 ? (
        <div className="rounded-[14px] border border-border bg-surface px-6 py-12 text-center">
          <p className="text-[14px] text-text-muted">Ничего не найдено по запросу «{query}»</p>
        </div>
      ) : (
        grouped.map(({ category, items }) => (
          <section
            key={category.id}
            className="overflow-hidden rounded-[14px] border border-border bg-surface"
          >
            <header className="flex items-center justify-between gap-3 border-b border-border bg-surface-hover px-4 py-3">
              <div className="min-w-0">
                <h3 className="text-[15px] font-medium text-text-primary">{category.name}</h3>
                <p className="text-[12px] text-text-muted">
                  {category.isSeasonal ? 'Сезонная категория' : 'Постоянная категория'} ·{' '}
                  {items.length} позиций
                </p>
              </div>

              <label className="flex shrink-0 items-center gap-2">
                <span className="text-[12px] text-text-muted">
                  {category.isActive ? 'Показывается' : 'Скрыта'}
                </span>
                <Toggle
                  checked={category.isActive}
                  onChange={async (value) => {
                    try {
                      await setCategoryActive(category.id, value);
                    } catch (error) {
                      onError(
                        error instanceof Error ? error.message : 'Не удалось изменить категорию',
                      );
                    }
                  }}
                  label={`Показывать категорию ${category.name}`}
                />
              </label>
            </header>

            <div>
              {items.map((component) => (
                <ComponentRow
                  key={component.id}
                  component={component}
                  unitLabel={category.quantity.unitLabel}
                  onError={onError}
                />
              ))}
            </div>
          </section>
        ))
      )}

      <p className="text-[12px] leading-[1.5] text-text-muted">
        Изменения сохраняются сразу и видны клиентам без перезагрузки. Цена
        подтверждается клавишей Enter или переходом к другому полю, отменяется — Escape.
        Позиция с ценой {formatPrice(0)} у декора означает «входит в стоимость».
      </p>
    </div>
  );
}
