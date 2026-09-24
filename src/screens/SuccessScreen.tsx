/**
 * Экран 4: заявка отправлена.
 *
 * Модель «заявка на согласование» требует особой аккуратности в словах:
 * человек ничего не купил и не оплатил, он попросил Ксению испечь. Поэтому
 * никаких «заказ оплачен» — только честное «заявка получена, вам ответят».
 */

import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useApp } from '@/context/AppContext';
import { formatPrice } from '@/lib/pricing';
import { getWebApp, hideBackButton } from '@/lib/telegram';
import { PICKUP } from '@/data/brand';

interface SuccessLocationState {
  orderId?: string;
  total?: number;
}

export function SuccessScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { resetConstructor, isTelegram } = useApp();

  const state = (location.state ?? {}) as SuccessLocationState;

  // Сборка больше не нужна: заявка ушла на сервер. Чистим состояние, чтобы
  // возврат на главную не показывал прежний десерт как незавершённый.
  useEffect(() => {
    resetConstructor();
    hideBackButton();
  }, [resetConstructor]);

  // Прямой заход по адресу без отправленной заявки — на главную.
  if (!state.orderId) {
    return (
      <main className="mx-auto flex min-h-[100svh] max-w-[520px] flex-col items-center justify-center px-4 text-center">
        <h1 className="text-[20px] leading-[1.3] font-medium text-text-primary">
          Здесь пока пусто
        </h1>
        <p className="mt-3 text-[15px] leading-[1.6] text-text-muted">
          Этот экран появляется после отправки заявки.
        </p>
        <div className="mt-8 w-full max-w-[320px]">
          <Button onClick={() => navigate('/')}>На главную</Button>
        </div>
      </main>
    );
  }

  const handleFinish = () => {
    const webApp = getWebApp();
    if (webApp) {
      webApp.close();
      return;
    }
    navigate('/');
  };

  return (
    <main className="mx-auto flex min-h-[100svh] max-w-[520px] flex-col items-center justify-center px-4 py-12 text-center">
      <div className="animate-rise flex flex-col items-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full border border-border bg-surface">
          <Check className="h-7 w-7 text-primary" strokeWidth={2.5} />
        </span>

        <h1 className="mt-6 text-[clamp(22px,6vw,28px)] leading-[1.2] font-medium tracking-[-0.02em] text-text-primary">
          Ваш кулинарный шедевр спроектирован
        </h1>

        <p className="mt-4 text-[15px] leading-[1.65] text-text-muted">
          Ксения уже получила вашу заявку. Она сверится с календарём выпечки и свяжется
          с вами, чтобы подтвердить дату и обсудить декор.
        </p>

        <div className="mt-6 w-full rounded-[14px] border border-border bg-surface-hover p-5 text-left">
          <p className="text-[13px] leading-[1.65] text-text-primary">
            <span className="font-medium">Оплата.</span> {PICKUP.paymentNote}
          </p>
          <p className="mt-3 text-[13px] leading-[1.65] text-text-primary">
            <span className="font-medium">Самовывоз.</span> {PICKUP.address}. Точное время
            согласуете в переписке. {PICKUP.deliveryNote}
          </p>
        </div>

        <dl className="mt-8 w-full rounded-[14px] border border-border bg-surface p-5">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-[13px] text-text-muted">Номер заявки</dt>
            <dd className="text-[15px] font-medium text-text-primary">{state.orderId}</dd>
          </div>
          {typeof state.total === 'number' && state.total > 0 && (
            <div className="mt-3 flex items-baseline justify-between gap-4 border-t border-border pt-3">
              <dt className="text-[13px] text-text-muted">Ориентировочная стоимость</dt>
              <dd className="text-[15px] font-medium text-text-primary">
                {formatPrice(state.total)}
              </dd>
            </div>
          )}
        </dl>

        <p className="mt-4 text-[12px] leading-[1.6] text-text-muted">
          Назовите номер заявки в переписке — так Ксении будет проще вас найти.
        </p>

        <div className="mt-8 w-full max-w-[320px]">
          <Button onClick={handleFinish}>
            {isTelegram ? 'Закрыть' : 'Вернуться на главную'}
          </Button>
        </div>
      </div>
    </main>
  );
}
