// Админка: сводка. Все цифры приходят с сервера и посчитаны из базы.
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { DemoBadge, Loading, Notice, PageHead, StatusBadge } from '../../components/ui.jsx';
import { carLabel, dateLabel, rub, timeLabel } from '../../format.js';

function LoadCard({ title, load }) {
  return (
    <div className="stat">
      <span className="stat-label">{title}</span>
      <b className="stat-value mono">{load.percent}%</b>
      <div className="meter" aria-hidden="true">
        <i style={{ width: `${Math.min(100, load.percent)}%` }} />
      </div>
      <span className="stat-note">
        {load.busy_hours} из {load.capacity_hours} пост-часов · записей: {load.bookings}
      </span>
    </div>
  );
}

export function Summary() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  function load() {
    setError('');
    api('/admin/summary')
      .then(setData)
      .catch((loadError) => setError(loadError.message));
  }
  useEffect(load, []);

  return (
    <main className="wrap page">
      <PageHead number="01" kicker="Админка" title="Сводка" />
      <Notice message={error} retry={load} />
      {!data && !error && <Loading />}
      {data && (
        <>
          <div className="stats">
            <Link className="stat stat--link" to="/admin/bookings?status=new">
              <span className="stat-label">Новые, не подтверждены</span>
              <b className={`stat-value mono${data.new_count ? ' red' : ''}`}>{data.new_count}</b>
              <span className="stat-note">записи на сегодня и вперёд →</span>
            </Link>
            <LoadCard title="Загрузка сегодня" load={data.load[0]} />
            <LoadCard title="Загрузка завтра" load={data.load[1]} />
            <div className="stat">
              <span className="stat-label">Выполнено за 7 дней</span>
              <b className="stat-value mono">{rub(data.revenue_7_days)}</b>
              <span className="stat-note">выполненных записей: {data.done_7_days}</span>
            </div>
          </div>

          <section className="block">
            <div className="block-head">
              <h2 className="block-title">Сегодня, {dateLabel(data.today)}</h2>
              <Link className="btn btn-line btn-sm" to="/admin/schedule">
                Расписание по постам
              </Link>
            </div>
            {data.bookings_today.length === 0 && <p className="muted">На сегодня записей нет.</p>}
            <div className="rows">
              {data.bookings_today.map((booking) => (
                <Link key={booking.id} className="row" to={`/admin/bookings/${booking.id}`}>
                  <span className="row-time mono">
                    {timeLabel(booking.starts_at)}–{timeLabel(booking.ends_at)}
                  </span>
                  <span className="row-main">
                    <b>{booking.customer_name}</b>
                    <small>
                      {carLabel(booking)} · {booking.items.map((item) => item.name).join(', ')}
                    </small>
                  </span>
                  <span className="row-sum mono">{rub(booking.total)}</span>
                  <span className="row-status">
                    <StatusBadge status={booking.status} />
                    <DemoBadge show={booking.is_demo} />
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
