/**
 * Главная кнопка действия (CTA).
 * Стайл-гайд, п. 5.1: высота 56px, скругление 14px, без теней.
 *
 * Состояния: default → hover → disabled → loading («магия творения»).
 * При клике на мобильном внутри Telegram срабатывает тактильный отклик.
 */

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { haptic } from '@/lib/telegram';

type ButtonVariant = 'primary' | 'ghost';

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  children: ReactNode;
  variant?: ButtonVariant;
  /** Состояние «Превращаем ингредиенты в искусство...»: градиент + блокировка. */
  isLoading?: boolean;
  /** Текст, подменяющий children на время загрузки. */
  loadingLabel?: string;
  /** Растянуть на всю ширину контейнера. */
  fullWidth?: boolean;
  /** Иконка слева от текста. */
  icon?: ReactNode;
}

export function Button({
  children,
  variant = 'primary',
  isLoading = false,
  loadingLabel = 'Превращаем ингредиенты в искусство...',
  fullWidth = true,
  icon,
  disabled,
  onClick,
  type = 'button',
  ...rest
}: ButtonProps) {
  const isBlocked = disabled || isLoading;

  const handleClick: ButtonProps['onClick'] = (event) => {
    if (isBlocked) return;
    // Тактильный отклик средней силы — стайл-гайд, п. 5.1
    haptic('medium');
    onClick?.(event);
  };

  const base = [
    'inline-flex items-center justify-center gap-2',
    'h-14 px-6 rounded-[14px]',
    'text-[16px] font-medium leading-none',
    'transition-all duration-200',
    'select-none',
    fullWidth ? 'w-full' : '',
  ];

  const byVariant: Record<ButtonVariant, string> = {
    primary: isLoading
      ? 'bg-magic text-white cursor-wait'
      : isBlocked
        ? 'bg-primary-disabled text-white/70 cursor-not-allowed'
        : 'bg-primary text-white hover:bg-primary-hover active:scale-[0.99] cursor-pointer',
    ghost: isBlocked
      ? 'border border-border text-text-muted/60 cursor-not-allowed'
      : 'border border-border text-text-primary hover:bg-surface-hover hover:border-border-active cursor-pointer',
  };

  return (
    <button
      type={type}
      disabled={isBlocked}
      onClick={handleClick}
      aria-busy={isLoading}
      className={[...base, byVariant[variant]].filter(Boolean).join(' ')}
      {...rest}
    >
      {isLoading ? (
        <span className="truncate">{loadingLabel}</span>
      ) : (
        <>
          {icon}
          <span className="truncate">{children}</span>
        </>
      )}
    </button>
  );
}
