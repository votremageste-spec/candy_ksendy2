/**
 * Глобальное состояние приложения на React Context.
 *
 * Сознательно без Redux/Zustand (ТЗ, п. 2): состояние небольшое и плоское,
 * встроенного контекста достаточно.
 *
 * Здесь живёт то, что переживает переходы между экранами:
 *  — окружение (Telegram или обычный браузер);
 *  — состояние конструктора, которое НЕ должно сбрасываться при ошибке сети
 *    (UX-flow, п. 3.3).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  getTelegramDisplayName,
  getTelegramUsername,
  initTelegram,
  isTelegramEnvironment,
} from '@/lib/telegram';
import { EMPTY_CONSTRUCTOR_STATE, type ConstructorState, type DessertCategory } from '@/types';

interface AppContextValue {
  /** Приложение открыто внутри Telegram. */
  isTelegram: boolean;
  /** Имя из профиля Telegram для предзаполнения формы. Пустая строка вне Telegram. */
  telegramName: string;
  /** Юзернейм вида @nickname. Пустая строка, если скрыт настройками приватности. */
  telegramUsername: string;

  /** Текущая сборка десерта. */
  constructor: ConstructorState;
  /** Точечное обновление полей конструктора. */
  updateConstructor: (patch: Partial<ConstructorState>) => void;
  /**
   * Выбор категории. Сбрасывает прежний выбор и подставляет количество
   * по умолчанию — начинки от торта в наборе моти оказаться не должны.
   */
  selectCategory: (category: DessertCategory) => void;
  /** Полный сброс — после успешно оформленного заказа. */
  resetConstructor: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [isTelegram, setIsTelegram] = useState(false);
  const [telegramName, setTelegramName] = useState('');
  const [telegramUsername, setTelegramUsername] = useState('');
  const [constructorState, setConstructorState] =
    useState<ConstructorState>(EMPTY_CONSTRUCTOR_STATE);

  // Инициализация Telegram один раз при монтировании приложения.
  useEffect(() => {
    initTelegram();
    setIsTelegram(isTelegramEnvironment());
    setTelegramName(getTelegramDisplayName());
    setTelegramUsername(getTelegramUsername());
  }, []);

  const updateConstructor = useCallback((patch: Partial<ConstructorState>) => {
    setConstructorState((previous) => ({ ...previous, ...patch }));
  }, []);

  const selectCategory = useCallback((category: DessertCategory) => {
    setConstructorState({
      ...EMPTY_CONSTRUCTOR_STATE,
      category,
      quantity: category.quantity.defaultValue,
    });
  }, []);

  const resetConstructor = useCallback(() => {
    setConstructorState(EMPTY_CONSTRUCTOR_STATE);
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      isTelegram,
      telegramName,
      telegramUsername,
      constructor: constructorState,
      updateConstructor,
      selectCategory,
      resetConstructor,
    }),
    [
      isTelegram,
      telegramName,
      telegramUsername,
      constructorState,
      updateConstructor,
      selectCategory,
      resetConstructor,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

/** Доступ к глобальному состоянию. Бросает исключение вне провайдера — Crash Early. */
export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp() вызван вне <AppProvider>. Оберни дерево компонентов в провайдер.');
  }
  return context;
}
