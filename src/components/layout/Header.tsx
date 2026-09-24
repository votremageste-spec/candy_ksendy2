/**
 * Шапка приложения. Присутствует на всех экранах, кроме стартового
 * (UX-flow, п. 1).
 *
 * Слева — «Назад», в центре — логотип, справа — вход в админку.
 * Внутри Telegram кнопка «Назад» дублируется нативной кнопкой мессенджера.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UserRound } from 'lucide-react';
import { BRAND } from '@/data/brand';
import { bindBackButton } from '@/lib/telegram';

interface HeaderProps {
  /** Куда вести кнопке «Назад». По умолчанию — на шаг назад в истории. */
  onBack?: () => void;
  /** Прогресс сборки: показывает тонкую малиновую полосу под шапкой. */
  progress?: { current: number; total: number };
}

export function Header({ onBack, progress }: HeaderProps) {
  const navigate = useNavigate();

  const handleBack = onBack ?? (() => navigate(-1));

  // Нативная кнопка «Назад» в Telegram делает то же, что и наша.
  useEffect(() => bindBackButton(handleBack), [handleBack]);

  const progressPercent = progress
    ? Math.min(100, Math.round((progress.current / progress.total) * 100))
    : null;

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-4">
        <button
          type="button"
          onClick={handleBack}
          aria-label="Назад"
          className="-ml-2 flex h-10 w-10 cursor-pointer items-center justify-center rounded-[10px] text-text-primary transition-colors duration-200 hover:bg-surface-hover"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={1.75} />
        </button>

        <span className="text-[15px] font-semibold tracking-[-0.01em] text-text-primary">
          {BRAND.name}
        </span>

        <button
          type="button"
          onClick={() => navigate('/admin')}
          aria-label="Вход для кондитера"
          className="-mr-2 flex h-10 w-10 cursor-pointer items-center justify-center rounded-[10px] text-text-muted transition-colors duration-200 hover:bg-surface-hover hover:text-text-primary"
        >
          <UserRound className="h-5 w-5" strokeWidth={1.75} />
        </button>
      </div>

      {progressPercent !== null && (
        <div
          className="h-[2px] w-full bg-border"
          role="progressbar"
          aria-valuenow={progress?.current}
          aria-valuemin={0}
          aria-valuemax={progress?.total}
          aria-label={`Шаг ${progress?.current} из ${progress?.total}`}
        >
          <div
            className="h-full bg-primary transition-[width] duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}
    </header>
  );
}
