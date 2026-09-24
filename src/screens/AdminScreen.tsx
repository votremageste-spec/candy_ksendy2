/**
 * Скрытый роут /admin — кабинет Ксении.
 *
 * Три состояния экрана, и у каждого свой вид:
 *   — не вошёл: кнопка входа через Google;
 *   — вошёл, но роли нет: честный отказ с возможностью сменить аккаунт;
 *   — администратор: две вкладки — каталог и заявки.
 *
 * Проверка роли здесь нужна для вида, а не для защиты: настоящая защита —
 * в правилах Firestore и в серверных маршрутах. Даже если подменить состояние
 * в браузере, база не отдаст ни одной заявки и не примет ни одной правки.
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleAlert, LogOut, RefreshCw } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { CardGridSkeleton, ErrorState } from '@/components/ui/Skeleton';
import { CatalogTable } from '@/components/admin/CatalogTable';
import { OrdersLog } from '@/components/admin/OrdersLog';
import { useCatalog } from '@/hooks/useCatalog';
import { fetchOrders } from '@/lib/adminApi';
import {
  checkIsAdmin,
  describeAuthError,
  signInWithGoogle,
  signOutAdmin,
  subscribeToAuth,
} from '@/lib/admin-auth';
import { isFirebaseConfigured } from '@/lib/firebase';
import type { AdminOrder, OrderStatus } from '@/types/api';
import type { User } from 'firebase/auth';

type Tab = 'catalog' | 'orders';

export function AdminScreen() {
  const navigate = useNavigate();

  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>('orders');
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  /** Приглушённое сообщение поверх содержимого: ошибка или предупреждение. */
  const [banner, setBanner] = useState<{ text: string; tone: 'error' | 'notice' } | null>(null);

  const catalog = useCatalog();

  /* ───────────────────────── Вход ───────────────────────── */

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setIsCheckingAuth(false);
      return;
    }

    return subscribeToAuth(async (nextUser) => {
      setUser(nextUser);
      setIsAdmin(nextUser ? await checkIsAdmin(nextUser) : false);
      setIsCheckingAuth(false);
    });
  }, []);

  const handleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (error) {
      setAuthError(describeAuthError(error));
    }
  };

  const handleSignOut = async () => {
    await signOutAdmin();
    setOrders([]);
    setBanner(null);
  };

  /* ──────────────────────── Заявки ──────────────────────── */

  const loadOrders = useCallback(async () => {
    setIsLoadingOrders(true);
    setOrdersError(null);
    try {
      setOrders(await fetchOrders());
    } catch (error) {
      setOrdersError(error instanceof Error ? error.message : 'Не удалось загрузить заявки');
    } finally {
      setIsLoadingOrders(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) void loadOrders();
  }, [isAdmin, loadOrders]);

  // Меняем статус в списке сразу, не дожидаясь повторной загрузки:
  // сервер уже подтвердил изменение, а перезапрос ради одной строки лишний.
  const handleStatusChanged = (orderId: string, status: OrderStatus) => {
    setOrders((previous) =>
      previous.map((order) => (order.id === orderId ? { ...order, status } : order)),
    );
  };

  /* ──────────────────── Отрисовка состояний ──────────────────── */

  if (!isFirebaseConfigured) {
    return (
      <>
        <Header onBack={() => navigate('/')} />
        <main className="mx-auto max-w-[560px] px-4 py-12">
          <ErrorState message="Firebase не настроен: заполните переменные VITE_FIREBASE_* в файле .env, иначе вход в кабинет невозможен." />
        </main>
      </>
    );
  }

  if (isCheckingAuth) {
    return (
      <>
        <Header onBack={() => navigate('/')} />
        <main className="mx-auto max-w-[1200px] px-4 py-6">
          <CardGridSkeleton count={4} />
        </main>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <Header onBack={() => navigate('/')} />
        <main className="mx-auto flex min-h-[calc(100svh-56px)] max-w-[420px] flex-col items-center justify-center px-4 text-center">
          <h1 className="text-[20px] leading-[1.3] font-medium tracking-[-0.01em] text-text-primary">
            Кабинет кондитера
          </h1>
          <p className="mt-3 text-[15px] leading-[1.6] text-text-muted">
            Управление каталогом, ценами и заявками. Вход по Google-аккаунту.
          </p>

          {authError && (
            <p className="mt-5 flex items-start gap-2 rounded-[10px] border border-primary/40 bg-surface px-4 py-3 text-left text-[13px] text-text-primary">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={1.75} />
              {authError}
            </p>
          )}

          <div className="mt-8 w-full">
            <Button onClick={handleSignIn}>Войти через Google</Button>
          </div>
        </main>
      </>
    );
  }

  if (!isAdmin) {
    return (
      <>
        <Header onBack={() => navigate('/')} />
        <main className="mx-auto flex min-h-[calc(100svh-56px)] max-w-[420px] flex-col items-center justify-center px-4 text-center">
          <h1 className="text-[20px] leading-[1.3] font-medium text-text-primary">
            Доступ закрыт
          </h1>
          <p className="mt-3 text-[15px] leading-[1.6] text-text-muted">
            Учётной записи {user.email} кабинет не открыт. Войдите под аккаунтом
            кондитера или попросите выдать доступ.
          </p>

          <div className="mt-8 flex w-full flex-col gap-3">
            <Button variant="ghost" onClick={handleSignIn}>
              Войти под другим аккаунтом
            </Button>
            <Button variant="ghost" onClick={() => navigate('/')}>
              Вернуться на главную
            </Button>
          </div>
        </main>
      </>
    );
  }

  /* ─────────────────────── Кабинет ─────────────────────── */

  return (
    <>
      <Header onBack={() => navigate('/')} />

      <main className="mx-auto max-w-[1200px] px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[20px] leading-[1.3] font-medium tracking-[-0.01em] text-text-primary">
              Управление кондитерской
            </h1>
            <p className="truncate text-[13px] text-text-muted">{user.email}</p>
          </div>

          <div className="flex items-center gap-2">
            {tab === 'orders' && (
              <button
                type="button"
                onClick={loadOrders}
                disabled={isLoadingOrders}
                aria-label="Обновить список заявок"
                className="flex h-10 cursor-pointer items-center gap-1.5 rounded-[10px] border border-border px-3 text-[13px] text-text-primary transition-colors duration-200 hover:bg-surface-hover disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isLoadingOrders ? 'animate-spin' : ''}`}
                  strokeWidth={1.75}
                />
                Обновить
              </button>
            )}

            <button
              type="button"
              onClick={handleSignOut}
              className="flex h-10 cursor-pointer items-center gap-1.5 rounded-[10px] border border-border px-3 text-[13px] text-text-primary transition-colors duration-200 hover:bg-surface-hover"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.75} />
              Выйти
            </button>
          </div>
        </div>

        {banner && (
          <div
            className={`mt-4 flex items-start justify-between gap-3 rounded-[10px] border px-4 py-3 text-[13px] ${
              banner.tone === 'error'
                ? 'border-primary/40 text-text-primary'
                : 'border-border-active text-text-primary'
            }`}
          >
            <span className="flex items-start gap-2">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={1.75} />
              {banner.text}
            </span>
            <button
              type="button"
              onClick={() => setBanner(null)}
              className="shrink-0 cursor-pointer text-[12px] text-text-muted hover:text-text-primary"
            >
              Скрыть
            </button>
          </div>
        )}

        <div role="tablist" className="mt-5 flex gap-2">
          {(
            [
              ['orders', 'Заявки'],
              ['catalog', 'Каталог'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              type="button"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`cursor-pointer rounded-[10px] border px-4 py-2 text-[14px] transition-all duration-200 ${
                tab === key
                  ? 'border-primary bg-primary text-white'
                  : 'border-border bg-surface text-text-primary hover:bg-surface-hover'
              }`}
            >
              {label}
              {key === 'orders' && orders.length > 0 && ` · ${orders.length}`}
            </button>
          ))}
        </div>

        <div className="mt-5">
          {tab === 'orders' ? (
            ordersError ? (
              <ErrorState message={ordersError} onRetry={loadOrders} />
            ) : isLoadingOrders && orders.length === 0 ? (
              <CardGridSkeleton count={4} />
            ) : (
              <OrdersLog
                orders={orders}
                onChanged={handleStatusChanged}
                onError={(text) => setBanner({ text, tone: 'error' })}
                onNotice={(text) => setBanner({ text, tone: 'notice' })}
              />
            )
          ) : catalog.error ? (
            <ErrorState message={catalog.error} />
          ) : catalog.isLoading ? (
            <CardGridSkeleton count={6} />
          ) : (
            <CatalogTable
              categories={catalog.categories}
              components={catalog.components}
              onError={(text) => setBanner({ text, tone: 'error' })}
            />
          )}
        </div>
      </main>
    </>
  );
}
