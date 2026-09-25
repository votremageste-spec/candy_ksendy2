/**
 * Вкладка «Заявки» в админке.
 *
 * Список отсортирован по дате самовывоза: Ксении важно, что печь завтра.
 * Карточка раскрывается по клику и показывает полный состав, контакты и
 * пожелания — то, ради чего раньше приходилось листать переписку.
 *
 * Смена статуса идёт через сервер: он же обновляет строку в Google Таблице.
 * Если таблица не отозвалась, действие остаётся выполненным, а рядом
 * появляется предупреждение — молчать о рассинхроне нельзя.
 */

import { useState } from 'react';
import { ChevronDown, MessageSquare, Phone, Trash2, TriangleAlert } from 'lucide-react';
import { formatPrice, formatQuantity } from '@/lib/pricing';
import { deleteOrder, updateOrderStatus } from '@/lib/adminApi';
import { ORDER_STATUS_LABELS, type AdminOrder, type OrderStatus } from '@/types/api';

interface OrdersLogProps {
  orders: AdminOrder[];
  onChanged: (orderId: string, status: OrderStatus) => void;
  onDeleted: (orderId: string) => void;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
}

/** Порядок переключения статусов — как они идут в жизни. */
const STATUS_ORDER: OrderStatus[] = ['pending', 'confirmed', 'completed', 'cancelled'];

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending: 'border-primary/40 text-primary',
  confirmed: 'border-border-active text-text-primary',
  completed: 'border-success/40 text-success',
  cancelled: 'border-border text-text-muted',
};

function formatDateTime(iso: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Насколько срочно: сегодня, завтра или уже прошло. */
function describeUrgency(iso: string): { label: string; isUrgent: boolean } | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const startOfDay = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();

  const days = Math.round((startOfDay(date) - startOfDay(new Date())) / 86_400_000);

  if (days < 0) return { label: 'прошло', isUrgent: false };
  if (days === 0) return { label: 'сегодня', isUrgent: true };
  if (days === 1) return { label: 'завтра', isUrgent: true };
  if (days <= 7) return { label: `через ${days} дн.`, isUrgent: false };
  return null;
}

function OrderCard({ order, onChanged, onDeleted, onError, onNotice }: {
  order: AdminOrder;
  onChanged: OrdersLogProps['onChanged'];
  onDeleted: OrdersLogProps['onDeleted'];
  onError: OrdersLogProps['onError'];
  onNotice: OrdersLogProps['onNotice'];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const urgency = describeUrgency(order.pickupTime);

  const changeStatus = async (status: OrderStatus) => {
    if (status === order.status || isSaving) return;

    setIsSaving(true);
    try {
      const result = await updateOrderStatus(order.id, status);
      onChanged(order.id, status);

      if (!result.sheetSynced) {
        onNotice(
          `Статус изменён, но в Google Таблице обновить не удалось — поправьте строку вручную. ${
            result.sheetError ?? ''
          }`.trim(),
        );
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Не удалось изменить статус');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (isDeleting) return;
    if (!window.confirm(`Удалить заявку ${order.id}? Это действие нельзя отменить.`)) return;

    setIsDeleting(true);
    try {
      const result = await deleteOrder(order.id);
      onDeleted(order.id);

      if (!result.sheetSynced) {
        onNotice(
          `Заявка удалена, но строку в Google Таблице убрать не удалось — удалите вручную. ${
            result.sheetError ?? ''
          }`.trim(),
        );
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Не удалось удалить заявку');
      setIsDeleting(false);
    }
  };

  return (
    <article className="overflow-hidden rounded-[14px] border border-border bg-surface">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        aria-expanded={isOpen}
        className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors duration-200 hover:bg-surface-hover"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[13px] text-text-muted">{order.id}</span>

            <span
              className={`rounded-[6px] border px-1.5 py-0.5 text-[11px] ${STATUS_STYLES[order.status]}`}
            >
              {ORDER_STATUS_LABELS[order.status]}
            </span>

            {urgency && (
              <span
                className={`text-[11px] ${urgency.isUrgent ? 'font-medium text-primary' : 'text-text-muted'}`}
              >
                {urgency.label}
              </span>
            )}

            {order.deliveryIssues && (
              <span
                className="flex items-center gap-1 text-[11px] text-primary"
                title="Заявка не дошла до таблицы или до Telegram"
              >
                <TriangleAlert className="h-3 w-3" strokeWidth={2} />
                сбой отправки
              </span>
            )}
          </div>

          <p className="mt-1 truncate text-[14px] text-text-primary">
            {order.product.categoryName} ·{' '}
            {formatQuantity(order.product.quantity, order.product.unitLabel)} ·{' '}
            {order.client.name}
          </p>

          <p className="mt-0.5 text-[12px] text-text-muted">
            Выдача: {formatDateTime(order.pickupTime)}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <div className="text-[15px] font-medium text-text-primary">
            {formatPrice(order.product.price)}
          </div>
          <ChevronDown
            className={`ml-auto mt-1 h-4 w-4 text-text-muted transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
            strokeWidth={1.75}
          />
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-border px-4 py-4">
          <dl className="flex flex-col gap-2">
            {order.product.details.map((detail) => (
              <div key={detail.label} className="flex items-baseline justify-between gap-4">
                <dt className="shrink-0 text-[13px] text-text-muted">{detail.label}</dt>
                <dd className="text-right text-[13px] text-text-primary">{detail.value}</dd>
              </div>
            ))}
          </dl>

          {order.product.inscription && (
            <p className="mt-3 rounded-[10px] border border-border bg-surface-hover p-3 text-[13px] text-text-primary">
              <span className="text-text-muted">Надпись:</span> «{order.product.inscription}»
            </p>
          )}

          {order.comment && (
            <p className="mt-3 rounded-[10px] border border-border bg-surface-hover p-3 text-[13px] text-text-primary">
              <span className="text-text-muted">Пожелания:</span> {order.comment}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={`tel:${order.client.phone}`}
              className="flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-2 text-[13px] text-text-primary transition-colors duration-200 hover:bg-surface-hover"
            >
              <Phone className="h-3.5 w-3.5" strokeWidth={1.75} />
              {order.client.phone}
            </a>

            {order.client.telegram && (
              <a
                href={`https://t.me/${order.client.telegram.replace(/^@/, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-2 text-[13px] text-text-primary transition-colors duration-200 hover:bg-surface-hover"
              >
                <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.75} />
                {order.client.telegram}
                {order.isTelegramVerified && (
                  <span className="text-[11px] text-success" title="Профиль подтверждён Telegram">
                    ✓
                  </span>
                )}
              </a>
            )}
          </div>

          <div className="mt-4 border-t border-border pt-4">
            <p className="mb-2 text-[12px] text-text-muted">Статус заявки</p>
            <div className="flex flex-wrap gap-2">
              {STATUS_ORDER.map((status) => (
                <button
                  key={status}
                  type="button"
                  disabled={isSaving}
                  onClick={() => changeStatus(status)}
                  className={`cursor-pointer rounded-[10px] border px-3 py-2 text-[13px] transition-all duration-200 disabled:cursor-wait disabled:opacity-60 ${
                    status === order.status
                      ? 'border-primary bg-primary text-white'
                      : 'border-border text-text-primary hover:border-border-active hover:bg-surface-hover'
                  }`}
                >
                  {ORDER_STATUS_LABELS[status]}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
            <p className="text-[11px] text-text-muted">
              Подана {formatDateTime(order.createdAt)} ·{' '}
              {order.source === 'telegram_mini_app' ? 'из Telegram' : 'с сайта'}
            </p>

            <button
              type="button"
              disabled={isDeleting}
              onClick={handleDelete}
              className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-[10px] border border-border px-3 py-2 text-[13px] text-text-muted transition-colors duration-200 hover:border-primary/40 hover:text-primary disabled:cursor-wait disabled:opacity-60"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              {isDeleting ? 'Удаление…' : 'Удалить'}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

export function OrdersLog({ orders, onChanged, onDeleted, onError, onNotice }: OrdersLogProps) {
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');

  const visible = filter === 'all' ? orders : orders.filter((order) => order.status === filter);

  const counts = STATUS_ORDER.reduce<Record<string, number>>((accumulator, status) => {
    accumulator[status] = orders.filter((order) => order.status === status).length;
    return accumulator;
  }, {});

  if (orders.length === 0) {
    return (
      <div className="rounded-[14px] border border-border bg-surface px-6 py-12 text-center">
        <p className="text-[14px] text-text-muted">
          Заявок пока нет. Здесь появится первая, как только клиент соберёт десерт.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`shrink-0 cursor-pointer rounded-[10px] border px-3 py-2 text-[13px] transition-all duration-200 ${
            filter === 'all'
              ? 'border-primary bg-primary text-white'
              : 'border-border bg-surface text-text-primary hover:bg-surface-hover'
          }`}
        >
          Все · {orders.length}
        </button>

        {STATUS_ORDER.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setFilter(status)}
            className={`shrink-0 cursor-pointer rounded-[10px] border px-3 py-2 text-[13px] transition-all duration-200 ${
              filter === status
                ? 'border-primary bg-primary text-white'
                : 'border-border bg-surface text-text-primary hover:bg-surface-hover'
            }`}
          >
            {ORDER_STATUS_LABELS[status]} · {counts[status] ?? 0}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-[14px] border border-border bg-surface px-6 py-12 text-center">
          <p className="text-[14px] text-text-muted">В этом статусе заявок нет</p>
        </div>
      ) : (
        visible.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            onChanged={onChanged}
            onDeleted={onDeleted}
            onError={onError}
            onNotice={onNotice}
          />
        ))
      )}
    </div>
  );
}
