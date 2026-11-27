// Админка: доска заказов по колонкам «новый → принят → готов → выдан».
// Список обновляется раз в 20 секунд. На телефоне колонки — вкладки.
import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Loading, Notice, PageHead } from '../components/ui.jsx';
import { ORDER_STATUS, dateTime, moscowToday, rub, time } from '../format.js';

const COLUMNS = ['new', 'accepted', 'ready', 'issued', 'cancelled'];
// Главная кнопка карточки: в какой статус перевести дальше.
const NEXT = { new: ['accepted', 'Принять'], accepted: ['ready', 'Готов'], ready: ['issued', 'Выдать'] };

export function readyText(value) {
  return value.startsWith(moscowToday()) ? time(value) : dateTime(value);
}

function OrderCard({ order, onStatus, busy }) {
  const next = NEXT[order.status];
  return (
    <article className={`card ticket ticket--${order.status}`}>
      <div className="ticket__head">
        <b>№ {order.id}</b>
        <span className="ticket__time">к {readyText(order.ready_at)}</span>
      </div>
      <p className="ticket__who">
        {order.customer_name} · <a href={`tel:${order.phone.replace(/[^\d+]/g, '')}`}>{order.phone}</a>
      </p>
      <ul className="ticket__items">
        {order.items.map((item) => (
          <li key={item.menu_item_id}>
            <span>{item.name}</span>
            <b>× {item.qty}</b>
          </li>
        ))}
      </ul>
      {order.comment && <p className="booking__comment">«{order.comment}»</p>}
      <div className="ticket__foot">
        <span>{rub(order.total)}</span>
        {next && (
          <div className="ticket__actions">
            <button type="button" className="btn btn--ghost btn--sm" disabled={busy} onClick={() => onStatus(order, 'cancelled')}>
              Отменить
            </button>
            <button type="button" className="btn btn--sm" disabled={busy} onClick={() => onStatus(order, next[0])}>
              {next[1]}
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

export function AdminOrders() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('new'); // какая колонка открыта на телефоне
  const [updated, setUpdated] = useState('');

  function load() {
    return api('/admin/orders')
      .then((data) => {
        setOrders(data.orders);
        setUpdated(new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      })
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 20000);
    return () => clearInterval(timer);
  }, []);

  async function changeStatus(order, status) {
    if (status === 'cancelled' && !window.confirm(`Отменить заказ № ${order.id}?`)) return;
    setBusy(true);
    setError('');
    try {
      await api(`/admin/orders/${order.id}/status`, 'POST', { status });
      await load();
    } catch (e) {
      setError(e.message);
      load();
    } finally {
      setBusy(false);
    }
  }

  if (!orders) return error ? <Notice type="error">{error}</Notice> : <Loading />;

  const byStatus = Object.fromEntries(COLUMNS.map((c) => [c, orders.filter((o) => o.status === c)]));

  return (
    <>
      <PageHead eyebrow="Заказы с собой" title="Доска заказов">
        <span className="muted small">Обновлено в {updated} · само раз в 20 секунд</span>
      </PageHead>
      <Notice type="error" onClose={() => setError('')}>{error}</Notice>
      <div className="board-tabs" role="tablist" aria-label="Колонки доски">
        {COLUMNS.map((c) => (
          <button key={c} type="button" role="tab" aria-selected={tab === c} onClick={() => setTab(c)}>
            {ORDER_STATUS[c]} <span>{byStatus[c].length}</span>
          </button>
        ))}
      </div>
      <div className="board">
        {COLUMNS.map((c) => (
          <section key={c} className={`board__col board__col--${c}${tab === c ? ' board__col--open' : ''}`}>
            <h2>
              {ORDER_STATUS[c]} <span>{byStatus[c].length}</span>
            </h2>
            {byStatus[c].length ? (
              byStatus[c].map((o) => <OrderCard key={o.id} order={o} onStatus={changeStatus} busy={busy} />)
            ) : (
              <p className="board__empty">Пусто</p>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
