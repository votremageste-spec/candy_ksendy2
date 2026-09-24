/**
 * Обёртка над Telegram WebApp API.
 * Приложение работает и как обычный сайт, и внутри Telegram — поэтому каждый
 * вызов безопасен вне мессенджера и молча превращается в no-op.
 */

import type { TelegramWebApp, TelegramWebAppUser } from '@/types/telegram';

/** Возвращает объект WebApp или null, если мы в обычном браузере. */
export function getWebApp(): TelegramWebApp | null {
  const webApp = window.Telegram?.WebApp;
  // Вне Telegram скрипт SDK всё равно может создать объект-пустышку без версии.
  if (!webApp || !webApp.initData) return null;
  return webApp;
}

/** true, если приложение открыто как Telegram Mini App. */
export function isTelegramEnvironment(): boolean {
  return getWebApp() !== null;
}

/**
 * Профиль пользователя из Telegram.
 *
 * ВАЖНО: данные берутся из initDataUnsafe и НЕ проверены подписью.
 * Использовать можно исключительно для предзаполнения формы — как удобство.
 * Любое доверие к личности пользователя на бэкенде должно строиться на проверке
 * подписи поля initData (Stage 5).
 */
export function getTelegramUser(): TelegramWebAppUser | null {
  return getWebApp()?.initDataUnsafe.user ?? null;
}

/** Готовое имя для подстановки в форму заказа. */
export function getTelegramDisplayName(): string {
  const user = getTelegramUser();
  if (!user) return '';
  return [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
}

/** Юзернейм в формате @nickname. Пустая строка, если он скрыт настройками приватности. */
export function getTelegramUsername(): string {
  const username = getTelegramUser()?.username;
  return username ? `@${username}` : '';
}

/** Тактильный отклик. Вне Telegram и на десктопе просто ничего не делает. */
export function haptic(style: 'light' | 'medium' | 'heavy' = 'medium'): void {
  getWebApp()?.HapticFeedback.impactOccurred(style);
}

/** Отклик на успех или ошибку — для экрана подтверждения заказа и тостов. */
export function hapticNotification(type: 'success' | 'error' | 'warning'): void {
  getWebApp()?.HapticFeedback.notificationOccurred(type);
}

/**
 * Первичная инициализация: сообщаем Telegram, что интерфейс готов,
 * разворачиваем окно на весь экран, наследуем тему мессенджера и красим
 * системные панели под нашу палитру.
 *
 * Тема берётся у Telegram, а не у системы: пользователь с тёмным Telegram
 * на светлом телефоне ожидает тёмное мини-приложение.
 */
export function initTelegram(): void {
  const webApp = getWebApp();
  if (!webApp) return;

  webApp.ready();
  webApp.expand();

  document.documentElement.dataset.theme = webApp.colorScheme === 'dark' ? 'dark' : 'light';

  // Панели Telegram красим тем же фоном, что и страницу, — иначе на стыке
  // остаётся чужая полоса. Значение читаем из палитры после смены темы.
  const background = getComputedStyle(document.documentElement)
    .getPropertyValue('--color-background')
    .trim();

  if (background) {
    webApp.setHeaderColor(background);
    webApp.setBackgroundColor(background);
  }
}

/**
 * Управление нативной кнопкой «Назад» в шапке Telegram.
 * Возвращает функцию отписки — обязательно вызывать при размонтировании.
 */
export function bindBackButton(handler: () => void): () => void {
  const webApp = getWebApp();
  if (!webApp) return () => {};

  webApp.BackButton.onClick(handler);
  webApp.BackButton.show();

  return () => {
    webApp.BackButton.offClick(handler);
    webApp.BackButton.hide();
  };
}

/** Скрыть нативную кнопку «Назад» (нужно на стартовом экране). */
export function hideBackButton(): void {
  getWebApp()?.BackButton.hide();
}
