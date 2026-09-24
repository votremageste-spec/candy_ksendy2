/**
 * Корневой компонент: маршрутизация и глобальное состояние.
 *
 * Один и тот же код работает и как обычный сайт, и как Telegram Mini App —
 * окружение определяется в AppProvider через window.Telegram.WebApp.
 *
 * Экраны, кроме стартового, подгружаются отдельными кусками. Firebase SDK
 * весит больше всего кода приложения, а нужен он только конструктору,
 * оформлению и админке. Стартовый экран — вход по ссылке из профиля
 * Instagram, и он обязан открываться мгновенно на мобильном интернете.
 */

import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppProvider } from '@/context/AppContext';
import { WelcomeScreen } from '@/screens/WelcomeScreen';

const ConstructorScreen = lazy(() =>
  import('@/screens/ConstructorScreen').then((module) => ({ default: module.ConstructorScreen })),
);
const SuccessScreen = lazy(() =>
  import('@/screens/SuccessScreen').then((module) => ({ default: module.SuccessScreen })),
);
const PrivacyPolicyScreen = lazy(() =>
  import('@/screens/PrivacyPolicyScreen').then((module) => ({
    default: module.PrivacyPolicyScreen,
  })),
);
const AdminScreen = lazy(() =>
  import('@/screens/AdminScreen').then((module) => ({ default: module.AdminScreen })),
);

/** Заставка на время загрузки куска кода. Тонкая полоса вместо пустого экрана. */
function RouteFallback() {
  return (
    <div className="flex min-h-[100svh] items-center justify-center bg-background">
      <div className="h-[2px] w-32 overflow-hidden rounded-full bg-border">
        <div className="bg-magic h-full w-full" />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<WelcomeScreen />} />
            <Route path="/constructor" element={<ConstructorScreen />} />
            <Route path="/success" element={<SuccessScreen />} />
            <Route path="/privacy-policy" element={<PrivacyPolicyScreen />} />
            <Route path="/admin" element={<AdminScreen />} />
            {/* Неизвестный адрес — молча возвращаем на главную, а не показываем 404 */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AppProvider>
  );
}
