/**
 * Табы переключения шагов конструктора.
 *
 * Пройденные шаги отмечаются галочкой — по табам видно, что осталось сделать.
 * Шаг «Количество» добавляется искусственным последним: он не описан
 * компонентами, но для пользователя это такой же шаг, как выбор начинки.
 */

import { Check } from 'lucide-react';

export interface TabDescriptor {
  key: string;
  label: string;
  isComplete: boolean;
}

interface StepTabsProps {
  tabs: TabDescriptor[];
  activeKey: string;
  onSelect: (key: string) => void;
}

export function StepTabs({ tabs, activeKey, onSelect }: StepTabsProps) {
  return (
    <div
      role="tablist"
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;

        return (
          <button
            key={tab.key}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onSelect(tab.key)}
            className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-[10px] border px-3 py-2 text-[14px] transition-all duration-200 ${
              isActive
                ? 'border-primary bg-primary text-white'
                : 'border-border bg-surface text-text-primary hover:border-border-active hover:bg-surface-hover'
            }`}
          >
            {tab.isComplete && (
              <Check
                className={`h-3.5 w-3.5 ${isActive ? 'text-white' : 'text-primary'}`}
                strokeWidth={3}
              />
            )}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
