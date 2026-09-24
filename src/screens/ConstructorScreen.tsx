/**
 * Экран 2: Workspace — пошаговый LEGO-конструктор десертов.
 *
 * Экран не знает, какие бывают категории и сколько у них шагов: всё это
 * приходит данными. Торт с начинкой и декором, набор моти с тестом и птичье
 * молоко с выбором трёх обсыпок из четырёх рисуются одним и тем же кодом.
 *
 * Раскладка следует стайл-гайду, п. 6: на десктопе 40 на 60, слева
 * прокручиваемый конструктор, справа закреплённое превью; на мобильном одна
 * лента с компактной плашкой сверху и кнопкой заказа, прижатой к низу.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { ComponentCard } from '@/components/ui/ComponentCard';
import { CardGridSkeleton, EmptyState, ErrorState } from '@/components/ui/Skeleton';
import { CheckoutDrawer } from '@/components/checkout/CheckoutDrawer';
import { CategoryPicker } from '@/components/constructor/CategoryPicker';
import { QuantityPicker } from '@/components/constructor/QuantityPicker';
import { StepTabs, type TabDescriptor } from '@/components/constructor/StepTabs';
import { SummaryPanel } from '@/components/constructor/SummaryPanel';
import { useApp } from '@/context/AppContext';
import { useCatalog } from '@/hooks/useCatalog';
import { getStepComponents, getVisibleCategories } from '@/lib/catalog';
import { calculatePrice, formatPrice } from '@/lib/pricing';
import { haptic } from '@/lib/telegram';
import { isComponentSelected, toggleComponent } from '@/lib/selection';
import type { DessertCategory, DessertComponent } from '@/types';

/** Искусственный шаг: количество не описано компонентами, но для клиента это шаг. */
const QUANTITY_TAB = 'quantity';

/** Подпись цены на карточке — зависит от роли компонента. */
function getPriceLabel(
  component: DessertComponent,
  category: DessertCategory,
  isVariant: boolean,
): string {
  if (isVariant) {
    return `${formatPrice(component.price)} / ${category.quantity.unitLabel}`;
  }
  return component.price > 0 ? `+ ${formatPrice(component.price)}` : 'Входит в стоимость';
}

export function ConstructorScreen() {
  const navigate = useNavigate();
  const { constructor, selectCategory, updateConstructor, resetConstructor } = useApp();
  const { categories, components, isLoading, error } = useCatalog();

  const [activeTab, setActiveTab] = useState<string>('');
  const [isCheckoutOpen, setCheckoutOpen] = useState(false);

  const category = constructor.category;
  const breakdown = useMemo(() => calculatePrice(constructor), [constructor]);

  /** Шаги категории плюс количество, если оно не зафиксировано. */
  const tabs = useMemo<TabDescriptor[]>(() => {
    if (!category) return [];

    const stepTabs = category.steps.map((step) => ({
      key: step.type,
      label: step.label,
      isComplete: (constructor.selection[step.type]?.length ?? 0) >= step.minSelect,
    }));

    if (category.quantity.isFixed) return stepTabs;

    return [
      ...stepTabs,
      {
        key: QUANTITY_TAB,
        label: category.pricingUnit === 'kg' ? 'Вес' : 'Количество',
        isComplete: constructor.quantity !== null,
      },
    ];
  }, [category, constructor.selection, constructor.quantity]);

  // При смене категории встаём на первый шаг.
  useEffect(() => {
    if (tabs.length > 0 && !tabs.some((tab) => tab.key === activeTab)) {
      setActiveTab(tabs[0].key);
    }
  }, [tabs, activeTab]);

  const handleSelectCategory = (next: DessertCategory) => {
    haptic('light');
    selectCategory(next);
  };

  const handleBack = () => {
    if (category) {
      // Из конструктора возвращаемся к выбору категории, а не на главную.
      resetConstructor();
      return;
    }
    navigate('/');
  };

  /* ─────────────────────── Загрузка и ошибки ─────────────────────── */

  if (error) {
    return (
      <>
        <Header onBack={() => navigate('/')} />
        <main className="mx-auto max-w-[1200px] px-4 py-10">
          <ErrorState message={error} onRetry={() => window.location.reload()} />
        </main>
      </>
    );
  }

  if (isLoading) {
    return (
      <>
        <Header onBack={() => navigate('/')} />
        <main className="mx-auto max-w-[1200px] px-4 py-6">
          <CardGridSkeleton count={6} />
        </main>
      </>
    );
  }

  /* ─────────────────────── Выбор категории ─────────────────────── */

  const visibleCategories = getVisibleCategories(categories);

  if (!category) {
    return (
      <>
        <Header onBack={() => navigate('/')} />
        <main className="mx-auto max-w-[1200px] px-4 py-6">
          {visibleCategories.length > 0 ? (
            <CategoryPicker
              categories={visibleCategories}
              components={components}
              onSelect={handleSelectCategory}
            />
          ) : (
            <EmptyState message="Сейчас приём заказов закрыт. Ксения скоро вернётся с новыми десертами." />
          )}
        </main>
      </>
    );
  }

  /* ─────────────────────── Пошаговая сборка ─────────────────────── */

  const activeStep = category.steps.find((step) => step.type === activeTab) ?? null;
  const stepComponents = activeStep
    ? getStepComponents(components, category.id, activeStep.type)
    : [];

  const variantPrice = constructor.selection.variant?.[0]?.price ?? null;
  const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.key === activeTab));

  const handleToggle = (component: DessertComponent) => {
    if (!activeStep) return;
    haptic('light');
    updateConstructor({
      selection: toggleComponent(constructor.selection, activeStep, component),
    });
  };

  const isReady = breakdown.isComplete && constructor.quantity !== null;

  /** Текст надписи нужен, только если выбран декор с надписью. */
  const needsInscription = (constructor.selection.decor ?? []).some((component) =>
    component.name.toLowerCase().includes('надпис'),
  );

  const constructorColumn = (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[20px] leading-[1.3] font-medium tracking-[-0.01em] text-text-primary">
          {category.name}
        </h1>
        <p className="mt-1 text-[13px] text-text-muted">{category.description}</p>
      </div>

      {/* Мобильный: компактное превью сверху, чтобы выбранное было на виду */}
      <div className="md:hidden">
        <SummaryPanel
          category={category}
          steps={category.steps}
          selection={constructor.selection}
          quantity={constructor.quantity}
          breakdown={breakdown}
          isCompact
        />
      </div>

      <StepTabs tabs={tabs} activeKey={activeTab} onSelect={setActiveTab} />

      {activeTab === QUANTITY_TAB ? (
        <QuantityPicker
          category={category}
          value={constructor.quantity}
          unitPrice={variantPrice}
          onChange={(quantity) => {
            haptic('light');
            updateConstructor({ quantity });
          }}
        />
      ) : activeStep ? (
        <div className="flex flex-col gap-3">
          {activeStep.hint && <p className="text-[13px] text-text-muted">{activeStep.hint}</p>}

          {activeStep.maxSelect > 1 && (
            <p className="text-[12px] text-text-muted">
              Выбрано {constructor.selection[activeStep.type]?.length ?? 0} из{' '}
              {activeStep.maxSelect}
            </p>
          )}

          {stepComponents.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {stepComponents.map((component) => (
                <ComponentCard
                  key={component.id}
                  component={component}
                  isSelected={isComponentSelected(
                    constructor.selection,
                    activeStep,
                    component.id,
                  )}
                  priceLabel={getPriceLabel(
                    component,
                    category,
                    activeStep.type === 'variant',
                  )}
                  onSelect={handleToggle}
                />
              ))}
            </div>
          ) : (
            <EmptyState message="На этом шаге пока нет доступных вариантов. Ксения скоро пополнит выбор." />
          )}

          {activeStep.type === 'decor' && needsInscription && (
            <label className="flex flex-col gap-2 rounded-[10px] border border-border bg-surface p-4">
              <span className="text-[14px] font-medium text-text-primary">
                Что написать на торте?
              </span>
              <input
                type="text"
                maxLength={60}
                value={constructor.inscription}
                onChange={(event) => updateConstructor({ inscription: event.target.value })}
                placeholder="Например: С днём рождения, Аня!"
                className="rounded-[10px] border border-border bg-background px-3 py-2.5 text-[14px] text-text-primary transition-colors duration-200 outline-none placeholder:text-text-muted/70 focus:border-border-active"
              />
              <span className="text-[12px] text-text-muted">
                До 60 символов. Ксения уточнит детали в Telegram.
              </span>
            </label>
          )}
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      <Header
        onBack={handleBack}
        progress={{ current: activeIndex + 1, total: tabs.length }}
      />

      <main className="mx-auto max-w-[1200px] px-4 pt-5 pb-28 md:pb-10">
        <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-10">
          {constructorColumn}

          {/* Десктоп: закреплённое превью справа */}
          <aside className="hidden md:block">
            <div className="sticky top-20 flex flex-col gap-4">
              <SummaryPanel
                category={category}
                steps={category.steps}
                selection={constructor.selection}
                quantity={constructor.quantity}
                breakdown={breakdown}
              />
              <Button disabled={!isReady} onClick={() => setCheckoutOpen(true)}>
                {isReady ? 'Оформить кулинарное чудо' : 'Пройдите все шаги'}
              </Button>
            </div>
          </aside>
        </div>
      </main>

      {/* Мобильный: сводка и кнопка, прижатые к низу экрана */}
      <div className="fixed right-0 bottom-0 left-0 z-10 border-t border-border bg-background/95 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] backdrop-blur-md md:hidden">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="text-[13px] text-text-muted">Итого</span>
          <span className="text-[18px] leading-none font-medium text-text-primary">
            {breakdown.total > 0 ? formatPrice(breakdown.total) : '—'}
          </span>
        </div>
        <Button disabled={!isReady} onClick={() => setCheckoutOpen(true)}>
          {isReady ? 'Оформить кулинарное чудо' : 'Пройдите все шаги'}
        </Button>
      </div>

      <CheckoutDrawer
        isOpen={isCheckoutOpen}
        onClose={() => setCheckoutOpen(false)}
        estimatedTotal={breakdown.total}
        onSuccess={(orderId, total) =>
          // Состояние конструктора чистится уже на экране успеха: до этого
          // момента сборка должна пережить возможный сбой сети.
          navigate('/success', { replace: true, state: { orderId, total } })
        }
      />
    </>
  );
}
