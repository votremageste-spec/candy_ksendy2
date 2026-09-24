/**
 * Правила валидации формы заявки.
 *
 * Файл общий для браузера и серверной функции. Это не экономия строк, а
 * требование корректности: если бы правила были описаны дважды, они бы
 * разошлись, и пользователь получал бы «поле заполнено верно» на клиенте
 * и отказ на сервере.
 *
 * Принцип Crash Early: проверяем до отправки, ошибку показываем рядом с полем.
 */

/** Минимальный срок до самовывоза: Ксении нужно время на закупку и выпечку. */
export const MIN_LEAD_HOURS = 48;

/** Имя: буквы русского и латинского алфавита, пробел, дефис, апостроф. */
const NAME_PATTERN = /^[А-Яа-яЁёA-Za-z\s'-]{2,50}$/u;

/** Телефон после очистки: 11 цифр, начинается с 7. */
const PHONE_DIGITS = 11;

/** Юзернейм Telegram: 5–32 символа, буквы, цифры и подчёркивание. */
const TELEGRAM_PATTERN = /^@?[A-Za-z0-9_]{5,32}$/;

/** Оставляет от строки только цифры и приводит 8 и +7 к единому виду. */
export function normalizePhone(input: string): string {
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('8')) digits = `7${digits.slice(1)}`;
  if (digits.length === 10 && !digits.startsWith('7')) digits = `7${digits}`;
  return digits;
}

/** Форматирование по маске +7 (999) 999-99-99 прямо во время ввода. */
export function formatPhone(input: string): string {
  const digits = normalizePhone(input).slice(0, PHONE_DIGITS);
  if (digits.length === 0) return '';

  const rest = digits.slice(1);
  let result = '+7';

  if (rest.length > 0) result += ` (${rest.slice(0, 3)}`;
  if (rest.length >= 3) result += ')';
  if (rest.length > 3) result += ` ${rest.slice(3, 6)}`;
  if (rest.length > 6) result += `-${rest.slice(6, 8)}`;
  if (rest.length > 8) result += `-${rest.slice(8, 10)}`;

  return result;
}

/** Самая ранняя допустимая дата самовывоза. */
export function getEarliestPickup(from: Date = new Date()): Date {
  return new Date(from.getTime() + MIN_LEAD_HOURS * 60 * 60 * 1000);
}

/** Значение для input[type=datetime-local]: местное время без часового пояса. */
export function toDateTimeLocalValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

export interface CheckoutFields {
  name: string;
  phone: string;
  telegram: string;
  pickupAt: string;
  comment: string;
  consent: boolean;
}

export type FieldErrors = Partial<Record<keyof CheckoutFields, string>>;

/**
 * Проверка всех полей формы.
 * Возвращает объект с ошибками по полям; пустой объект означает, что всё в порядке.
 */
export function validateCheckout(fields: CheckoutFields): FieldErrors {
  const errors: FieldErrors = {};

  const name = fields.name.trim();
  if (name.length < 2) {
    errors.name = 'Напишите, как к вам обращаться — минимум две буквы';
  } else if (!NAME_PATTERN.test(name)) {
    errors.name = 'В имени допустимы только буквы, пробел и дефис';
  }

  const phoneDigits = normalizePhone(fields.phone);
  if (phoneDigits.length === 0) {
    errors.phone = 'Без телефона Ксения не сможет с вами связаться';
  } else if (phoneDigits.length !== PHONE_DIGITS || !phoneDigits.startsWith('7')) {
    errors.phone = 'Проверьте номер: нужен российский формат +7 (999) 999-99-99';
  }

  // Telegram необязателен: связаться можно и по телефону.
  const telegram = fields.telegram.trim();
  if (telegram.length > 0 && !TELEGRAM_PATTERN.test(telegram)) {
    errors.telegram = 'Ник должен быть от 5 до 32 символов: буквы, цифры и подчёркивание';
  }

  if (!fields.pickupAt) {
    errors.pickupAt = 'Выберите желаемую дату и время';
  } else {
    const pickup = new Date(fields.pickupAt);
    if (Number.isNaN(pickup.getTime())) {
      errors.pickupAt = 'Не удалось разобрать дату';
    } else if (pickup.getTime() < getEarliestPickup().getTime()) {
      errors.pickupAt = `Для создания шедевра Ксении нужно минимум ${MIN_LEAD_HOURS} часа. Выберите дату позже`;
    }
  }

  if (fields.comment.length > 500) {
    errors.comment = 'Пожалуйста, короче — не больше 500 символов';
  }

  if (!fields.consent) {
    errors.consent = 'Без согласия на обработку данных мы не можем принять заявку';
  }

  return errors;
}

/** Приводит юзернейм к виду @nickname для хранения и отправки. */
export function normalizeTelegram(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
}
