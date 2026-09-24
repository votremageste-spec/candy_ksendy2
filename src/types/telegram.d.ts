/**
 * Минимальная типизация Telegram WebApp API.
 * Официальный SDK подключается скриптом в index.html и типов не поставляет.
 * Описываем только то, что реально используем.
 */

export interface TelegramWebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

export interface TelegramHapticFeedback {
  impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
  notificationOccurred(type: 'error' | 'success' | 'warning'): void;
  selectionChanged(): void;
}

export interface TelegramBackButton {
  isVisible: boolean;
  show(): void;
  hide(): void;
  onClick(callback: () => void): void;
  offClick(callback: () => void): void;
}

export interface TelegramWebApp {
  /** Подписанные данные инициализации. ТОЛЬКО их можно проверять на бэкенде. */
  initData: string;
  /** Разобранные данные БЕЗ проверки подписи. Подделываются — доверять нельзя. */
  initDataUnsafe: {
    user?: TelegramWebAppUser;
    start_param?: string;
  };
  colorScheme: 'light' | 'dark';
  themeParams: Record<string, string>;
  isExpanded: boolean;
  viewportHeight: number;
  platform: string;
  version: string;

  ready(): void;
  expand(): void;
  close(): void;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;

  HapticFeedback: TelegramHapticFeedback;
  BackButton: TelegramBackButton;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

export {};
