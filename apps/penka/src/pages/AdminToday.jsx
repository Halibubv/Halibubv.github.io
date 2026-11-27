// Админка, экран «Сегодня»: брони на сегодня по времени, активные заказы и цифры.
// Все цифры считает сервер по базе (GET /api/admin/today).
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Empty, Loading, Notice, PageHead, StatusBadge } from '../components/ui.jsx';
import { ORDER_STATUS, RESERVATION_STATUS, ZONES, longDay, plural, rub, time } from '../format.js';

export function AdminToday({ demo }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let stopped = false;
    function load() {
      api('/admin/today')
        .then((d) => !stopped && setData(d))
        .catch((e) => !stopped && setError(e.message));
    }
    load();
    const timer = setInterval(load, 20000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, []);

  if (!data) return error ? <Notice type="error">{error}</Notice> : <Loading />;

  const activeReservations = data.reservations.filter((r) => ['new', 'confirmed', 'seated'].includes(r.status));
  const stats = [
    { label: 'гостей ждём сегодня', value: data.guests_expected, note: `${activeReservations.length} ${plural(activeReservations.length, 'бронь', 'брони', 'броней')}` },
    { label: 'заказов в работе', value: data.active_orders.length, note: 'новые, принятые и готовые' },
    { label: 'выручка сегодня', value: rub(data.revenue_today), note: `выдано ${data.issued_today} ${plural(data.issued_today, 'заказ', 'заказа', 'заказов')}` },
    { label: 'выручка за 7 дней', value: rub(data.revenue_week), note: 'по выданным заказам' },
  ];

  return (
    <>
      <PageHead eyebrow={longDay(data.date)} title="Сегодня в Пенке" />
      {demo && <Notice>Цифры посчитаны по демонстрационным броням и заказам.</Notice>}
      <Notice type="error" onClose={() => setError('')}>{error}</Notice>
      <div className="stats">
        {stats.map((s) => (
          <div className="stat" key={s.label}>
            <b>{s.value}</b>
            <span>{s.label}</span>
            <small>{s.note}</small>
          </div>
        ))}
      </div>

      <div className="two-cols two-cols--wide">
        <section className="card">
          <div className="card__head">
            <h2 className="card__title">Брони на сегодня</h2>
            <Link to="/admin/reservations">Все брони →</Link>
          </div>
          {data.reservations.length ? (
            <ul className="timeline">
              {data.reservations.map((r) => (
                <li key={r.id} className={['cancelled', 'no_show', 'closed'].includes(r.status) ? 'timeline__past' : ''}>
                  <span className="timeline__time">{time(r.starts_at)}</span>
                  <div>
                    <b>{r.customer_name}</b> · {r.guests} {plural(r.guests, 'гость', 'гостя', 'гостей')}
                    <small>
                      столик № {r.table_label}, {ZONES[r.zone]}
                      {r.comment ? ` · «${r.comment}»` : ''}
                    </small>
                  </div>
                  <StatusBadge status={r.status} labels={RESERVATION_STATUS} />
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="Сегодня броней нет" />
          )}
        </section>

        <section className="card">
          <div className="card__head">
            <h2 className="card__title">Заказы в работе</h2>
            <Link to="/admin/orders">Доска заказов →</Link>
          </div>
          {data.active_orders.length ? (
            <ul className="timeline">
              {data.active_orders.map((o) => (
                <li key={o.id}>
                  <span className="timeline__time">{time(o.ready_at)}</span>
                  <div>
                    <b>№ {o.id}</b> · {o.customer_name}
                    <small>{o.items.map((i) => `${i.name} × ${i.qty}`).join(', ')}</small>
                  </div>
                  <StatusBadge status={o.status} labels={ORDER_STATUS} />
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="Активных заказов нет" />
          )}
        </section>
      </div>
    </>
  );
}
