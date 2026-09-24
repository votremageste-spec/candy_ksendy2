/**
 * Состояния загрузки и ошибки.
 * Стайл-гайд, п. 7: пустых экранов и дефолтных заглушек быть не должно —
 * у каждого состояния свой внятный вид.
 */

import { CloudOff } from 'lucide-react';

/** Пульсирующий прямоугольник вместо контента. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-[10px] bg-surface-hover ${className}`} />;
}

/** Сетка скелетонов на месте будущих карточек. */
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-[10px] border border-border bg-surface"
        >
          <Skeleton className="aspect-[4/3] w-full rounded-none" />
          <div className="flex flex-col gap-2 p-3">
            <Skeleton className="h-4 w-3/4 rounded-[6px]" />
            <Skeleton className="h-3 w-1/2 rounded-[6px]" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

/** Приглушённое сообщение об ошибке — без кричащих красных плашек. */
export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-[14px] border border-border bg-surface px-6 py-12 text-center">
      <CloudOff className="h-8 w-8 text-text-muted" strokeWidth={1.25} />
      <p className="max-w-[320px] text-[14px] leading-[1.6] text-text-muted">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="cursor-pointer rounded-[10px] border border-border px-4 py-2 text-[13px] text-text-primary transition-colors duration-200 hover:bg-surface-hover"
        >
          Попробовать снова
        </button>
      )}
    </div>
  );
}

/** Категория без единого доступного ингредиента. */
export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-[14px] border border-border bg-surface px-6 py-12 text-center">
      <p className="mx-auto max-w-[320px] text-[14px] leading-[1.6] text-text-muted">{message}</p>
    </div>
  );
}
