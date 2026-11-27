// Кабинет: мои заказы с собой. Статус обновляется сам раз в 30 секунд.
// «Повторить» кладёт позиции в корзину лендинга (кроме стоп-листа).
import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { repeatOrder } from '../cart.js';
import { Empty, Loading, Notice, PageHead, StatusBadge } from '../components/ui.jsx';
import { ORDER_STATUS, dateTime, rub } from '../format.js';

const STEPS = ['new', 'accepted', 'ready', 'issued'];

// Полоска «новый → принят → готов → выдан».
function Progress({ status }) {
  if (status === 'cancelled') return null;
  const current = STEPS.indexOf(status);
  return (
    <ol className="progress-steps" aria-label="Статус заказа">
      {STEPS.map((step, k) => (
        <li key={step} className={k <= current ? 'done' : ''} aria-current={k === current ? 'step' : undefined}>
          {ORDER_STATUS[step]}
        </li>
      ))}
    </ol>
  );
}

export function AccountOrders() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const [repeat, setRepeat] = useState(null);

  useEffect(() => {
    let stopped = false;
    function load() {
      api('/account/orders')
        .then((data) => !stopped && setOrders(data.orders))
        .catch((e) => !stopped && setError(e.message));
    }
    load();
    const timer = setInterval(load, 30000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, []);

  async function again(order) {
    setError('');
    try {
      const data = await api('/menu');
      const items = data.categories.flatMap((c) => c.items);
      setRepeat({ order: order.id, ...repeatOrder(order, items) });
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <>
      <PageHead eyebrow="Личный кабинет" title="Мои заказы">
        <a className="btn btn--sm" href="/#menu">
          Заказать с собой
        </a>
      </PageHead>
      <Notice type="error" onClose={() => setError('')}>{error}</Notice>
      {repeat && (
        <Notice type={repeat.added.length ? 'success' : 'error'} onClose={() => setRepeat(null)}>
          {repeat.added.length > 0 && <>Добавили в корзину: {repeat.added.join(', ')}. </>}
          {repeat.skipped.length > 0 && <>Сейчас нет в наличии: {repeat.skipped.join(', ')} — эти позиции не добавлены. </>}
          {repeat.added.length > 0 && (
            <a className="notice__link" href="/#cart">
              Открыть корзину →
            </a>
          )}
        </Notice>
      )}
      {!orders && !error && <Loading />}
      {orders && !orders.length && (
        <Empty title="Заказов пока нет">
          <p>Нажмите «+» у позиции в меню на сайте, и заказ будет готов к нужному времени.</p>
        </Empty>
      )}
      {orders && orders.length > 0 && (
        <div className="grid-cards">
          {orders.map((order) => (
            <article className="card order" key={order.id}>
              <div className="order__head">
                <p className="order__num">Заказ № {order.id}</p>
                <StatusBadge status={order.status} labels={ORDER_STATUS} />
              </div>
              <p className="muted">К {dateTime(order.ready_at)}</p>
              <Progress status={order.status} />
              <ul className="order__items">
                {order.items.map((item) => (
                  <li key={item.menu_item_id}>
                    <span>
                      {item.name} × {item.qty}
                    </span>
                    <span>{rub(item.price * item.qty)}</span>
                  </li>
                ))}
              </ul>
              {order.comment && <p className="booking__comment">«{order.comment}»</p>}
              <div className="order__foot">
                <b>{rub(order.total)}</b>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => again(order)}>
                  Повторить
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
