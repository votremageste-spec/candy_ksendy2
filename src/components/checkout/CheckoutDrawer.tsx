/**
 * Экран 3: оформление заявки — выезжающая снизу карточка (UX-flow v3, п. 2.3).
 *
 * Модель «заявка на согласование»: клиент не платит здесь и сейчас, он
 * отправляет заявку, а Ксения связывается лично. Поэтому кнопка называется
 * не «Оплатить», и вся формулировка настраивает на разговор.
 *
 * Валидация по принципу Crash Early: ошибка показывается под конкретным полем
 * до отправки. Те же правила выполняются на сервере — из общего файла
 * validation.ts, так что «прошло на клиенте, отказ на сервере» невозможно.
 */

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useApp } from '@/context/AppContext';
import { submitOrder } from '@/lib/orderApi';
import { hapticNotification } from '@/lib/telegram';
import {
  formatPhone,
  getEarliestPickup,
  toDateTimeLocalValue,
  validateCheckout,
  type FieldErrors,
} from '@/lib/validation';
import { HONEYPOT_FIELD } from '@/types/api';
import { formatPrice } from '@/lib/pricing';
import { PICKUP } from '@/data/brand';

interface CheckoutDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Ориентировочная сумма — показывается клиенту, но на сервер не отправляется. */
  estimatedTotal: number;
  onSuccess: (orderId: string, total: number) => void;
}

const inputClass =
  'w-full rounded-[10px] border bg-background px-3 py-2.5 text-[15px] text-text-primary ' +
  'transition-colors duration-200 outline-none placeholder:text-text-muted/70';

export function CheckoutDrawer({
  isOpen,
  onClose,
  estimatedTotal,
  onSuccess,
}: CheckoutDrawerProps) {
  const { constructor, telegramName, telegramUsername, isTelegram } = useApp();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [telegram, setTelegram] = useState('');
  const [pickupAt, setPickupAt] = useState('');
  const [comment, setComment] = useState('');
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState('');

  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);

  // Профиль из Telegram подставляем один раз при открытии и только в пустые
  // поля: если человек уже что-то исправил, перезатирать его ввод нельзя.
  useEffect(() => {
    if (!isOpen) return;
    setName((current) => current || telegramName);
    setTelegram((current) => current || telegramUsername);
  }, [isOpen, telegramName, telegramUsername]);

  // Пока карточка открыта, фон не прокручивается — иначе на мобильном
  // страница уезжает под формой.
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSending) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isSending, onClose]);

  if (!isOpen) return null;

  const minPickup = toDateTimeLocalValue(getEarliestPickup());

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const fields = { name, phone, telegram, pickupAt, comment, consent };
    const nextErrors = validateCheckout(fields);

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      hapticNotification('error');
      // Подводим к первому проблемному полю, а не оставляем искать глазами.
      dialogRef.current
        ?.querySelector<HTMLElement>('[data-invalid="true"]')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setErrors({});
    setIsSending(true);

    const result = await submitOrder({
      state: constructor,
      name,
      phone,
      telegram,
      pickupAt,
      comment,
      honeypot,
    });

    setIsSending(false);

    if (result.ok) {
      hapticNotification('success');
      onSuccess(result.orderId, result.total);
      return;
    }

    hapticNotification('error');
    setFormError(result.error);
    if (result.fields) setErrors(result.fields as FieldErrors);
  };

  const fieldBorder = (hasError: boolean) =>
    hasError ? 'border-error' : 'border-border focus:border-border-active';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Затемнение. Клик закрывает форму, но не во время отправки. */}
      <button
        type="button"
        aria-label="Закрыть"
        onClick={() => !isSending && onClose()}
        className="absolute inset-0 cursor-default bg-text-primary/25 backdrop-blur-[2px]"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Оформление заявки"
        className="animate-rise relative flex max-h-[92svh] w-full max-w-[520px] flex-col overflow-hidden rounded-t-[14px] border border-border bg-surface shadow-sm sm:rounded-[14px]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-[18px] leading-[1.3] font-medium tracking-[-0.01em] text-text-primary">
              Заявка на десерт
            </h2>
            <p className="mt-1 text-[13px] leading-[1.5] text-text-muted">
              Ксения свяжется с вами, чтобы подтвердить дату и обсудить детали
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSending}
            aria-label="Закрыть"
            className="-mt-1 -mr-2 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[10px] text-text-muted transition-colors duration-200 hover:bg-surface-hover disabled:cursor-not-allowed"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex flex-col gap-4 px-5 py-5">
            {/* Имя */}
            <label className="flex flex-col gap-1.5" data-invalid={Boolean(errors.name)}>
              <span className="text-[13px] font-medium text-text-primary">Как вас зовут</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Александра"
                autoComplete="name"
                className={`${inputClass} ${fieldBorder(Boolean(errors.name))}`}
              />
              {errors.name && <span className="text-[12px] text-error">{errors.name}</span>}
            </label>

            {/* Телефон */}
            <label className="flex flex-col gap-1.5" data-invalid={Boolean(errors.phone)}>
              <span className="text-[13px] font-medium text-text-primary">Телефон</span>
              <input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(event) => setPhone(formatPhone(event.target.value))}
                placeholder="+7 (999) 999-99-99"
                autoComplete="tel"
                className={`${inputClass} ${fieldBorder(Boolean(errors.phone))}`}
              />
              {errors.phone && <span className="text-[12px] text-error">{errors.phone}</span>}
            </label>

            {/* Telegram */}
            <label className="flex flex-col gap-1.5" data-invalid={Boolean(errors.telegram)}>
              <span className="text-[13px] font-medium text-text-primary">
                Telegram <span className="font-normal text-text-muted">— необязательно</span>
              </span>
              <input
                type="text"
                value={telegram}
                onChange={(event) => setTelegram(event.target.value)}
                placeholder="@nickname"
                className={`${inputClass} ${fieldBorder(Boolean(errors.telegram))}`}
              />
              {isTelegram && telegramUsername && (
                <span className="text-[12px] text-text-muted">Подставлено из вашего профиля</span>
              )}
              {errors.telegram && (
                <span className="text-[12px] text-error">{errors.telegram}</span>
              )}
            </label>

            {/* Дата самовывоза */}
            <label className="flex flex-col gap-1.5" data-invalid={Boolean(errors.pickupAt)}>
              <span className="text-[13px] font-medium text-text-primary">
                Когда хотите забрать
              </span>
              <input
                type="datetime-local"
                value={pickupAt}
                min={minPickup}
                onChange={(event) => setPickupAt(event.target.value)}
                className={`${inputClass} ${fieldBorder(Boolean(errors.pickupAt))}`}
              />
              <span className="text-[12px] leading-[1.5] text-text-muted">
                Не раньше чем через двое суток. Самовывоз: {PICKUP.address}. Точное время
                согласуете с Ксенией в переписке. {PICKUP.deliveryNote}
              </span>
              {errors.pickupAt && (
                <span className="text-[12px] text-error">{errors.pickupAt}</span>
              )}
            </label>

            {/* Пожелания */}
            <label className="flex flex-col gap-1.5" data-invalid={Boolean(errors.comment)}>
              <span className="text-[13px] font-medium text-text-primary">
                Пожелания <span className="font-normal text-text-muted">— необязательно</span>
              </span>
              <textarea
                value={comment}
                rows={3}
                maxLength={500}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Аллергии, пожелания по декору, повод"
                className={`${inputClass} resize-none ${fieldBorder(Boolean(errors.comment))}`}
              />
              {errors.comment && <span className="text-[12px] text-error">{errors.comment}</span>}
            </label>

            {/*
              Ловушка для ботов. Скрыта от человека и от программ чтения экрана,
              автозаполнение отключено. Заполненное поле — верный признак бота.
            */}
            <input
              type="text"
              name={HONEYPOT_FIELD}
              value={honeypot}
              onChange={(event) => setHoneypot(event.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              style={{ position: 'absolute', left: '-9999px', width: 1, height: 1 }}
            />

            {/* Согласие по 152-ФЗ */}
            <label
              className="flex cursor-pointer items-start gap-3"
              data-invalid={Boolean(errors.consent)}
            >
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
                className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer accent-primary"
              />
              <span className="text-[13px] leading-[1.5] text-text-muted">
                Согласен на обработку персональных данных в соответствии с{' '}
                <a
                  href="/privacy-policy"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline underline-offset-2"
                >
                  политикой конфиденциальности
                </a>
              </span>
            </label>
            {errors.consent && (
              <span className="-mt-2 text-[12px] text-error">{errors.consent}</span>
            )}

            {formError && (
              <p className="rounded-[10px] border border-border bg-surface-hover p-3 text-[13px] leading-[1.5] text-error">
                {formError}
              </p>
            )}
          </div>

          <div className="sticky bottom-0 border-t border-border bg-surface px-5 pt-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
            <div className="mb-3 flex items-baseline justify-between">
              <span className="text-[13px] text-text-muted">Ориентировочно</span>
              <span className="text-[18px] leading-none font-medium text-text-primary">
                {formatPrice(estimatedTotal)}
              </span>
            </div>

            <Button type="submit" isLoading={isSending}>
              Отправить заявку
            </Button>

            <p className="mt-3 text-center text-[12px] leading-[1.5] text-text-muted">
              Это заявка, а не оплата. Окончательную стоимость Ксения подтвердит в переписке.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
