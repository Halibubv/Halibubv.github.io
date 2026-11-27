// Админка: расписание дня по постам — сетка «время × пост» с записями.
// Номер поста сервер выбирает условно: ставит запись на первый свободный к её началу пост.
import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../api.js';
import { Loading, Notice, PageHead } from '../../components/ui.jsx';
import { STATUS_LABELS, carLabel, dateLabel, localDate, offsetDate, timeLabel } from '../../format.js';

export function Schedule() {
  const [params, setParams] = useSearchParams();
  const date = params.get('date') || localDate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  function load() {
    setError('');
    setData(null);
    api(`/admin/schedule?date=${date}`)
      .then(setData)
      .catch((loadError) => setError(loadError.message));
  }
  useEffect(load, [date]);

  const go = (value) => setParams({ date: value }, { replace: true });

  let grid = null;
  if (data) {
    const { posts, open_hour: open, close_hour: close } = data.settings;
    const hours = Array.from({ length: close - open }, (_, i) => open + i);
    const overflow = data.bookings.filter((b) => !b.post);
    grid = (
      <>
        <div className="schedule-scroll">
          <div
            className="schedule"
            style={{
              gridTemplateColumns: `64px repeat(${posts}, minmax(150px, 1fr))`,
              gridTemplateRows: `40px repeat(${hours.length}, 64px)`,
            }}
          >
            <div className="schedule-corner" />
            {Array.from({ length: posts }, (_, i) => (
              <div key={i} className="schedule-post" style={{ gridColumn: i + 2, gridRow: 1 }}>
                Пост {i + 1}
              </div>
            ))}
            {hours.map((hour, i) => (
              <React.Fragment key={hour}>
                <div className="schedule-hour mono" style={{ gridColumn: 1, gridRow: i + 2 }}>
                  {String(hour).padStart(2, '0')}:00
                </div>
                {Array.from({ length: posts }, (_, p) => (
                  <div key={p} className="schedule-cell" style={{ gridColumn: p + 2, gridRow: i + 2 }} />
                ))}
              </React.Fragment>
            ))}
            {data.bookings
              .filter((b) => b.post)
              .map((booking) => {
                const startHour = Number(booking.starts_at.slice(11, 13));
                const endHour = Number(booking.ends_at.slice(11, 13)) || 24;
                const rowStart = Math.max(0, startHour - open) + 2;
                const rowEnd = Math.min(close, endHour) - open + 2;
                return (
                  <Link
                    key={booking.id}
                    to={`/admin/bookings/${booking.id}`}
                    className={`schedule-booking schedule-booking--${booking.status}`}
                    style={{ gridColumn: booking.post + 1, gridRow: `${rowStart} / ${Math.max(rowEnd, rowStart + 1)}` }}
                    title={`${booking.customer_name}, ${STATUS_LABELS[booking.status]}`}
                  >
                    <span className="mono">
                      {timeLabel(booking.starts_at)}–{timeLabel(booking.ends_at)} · № {booking.number}
                    </span>
                    <b>{booking.customer_name}</b>
                    <small>{carLabel(booking)}</small>
                    <small>{booking.items.map((item) => item.name).join(', ')}</small>
                  </Link>
                );
              })}
          </div>
        </div>
        {overflow.length > 0 && (
          <Notice
            message={`Записей больше, чем постов (например, после уменьшения числа постов): ${overflow
              .map((b) => `№ ${b.number}`)
              .join(', ')}.`}
          />
        )}
        <p className="legend">
          {['new', 'confirmed', 'in_work', 'done'].map((status) => (
            <span key={status} className={`legend-item schedule-booking--${status}`}>
              {STATUS_LABELS[status]}
            </span>
          ))}
        </p>
      </>
    );
  }

  return (
    <main className="wrap page">
      <PageHead number="03" kicker="Админка" title="Расписание" />
      <div className="day-switch">
        <button className="btn btn-line btn-sm" type="button" onClick={() => go(offsetDate(date, -1))} aria-label="Предыдущий день">
          ←
        </button>
        <label className="day-switch-label">
          <b>{dateLabel(date)}</b>
          <input type="date" value={date} onChange={(e) => e.target.value && go(e.target.value)} aria-label="Дата" />
        </label>
        <button className="btn btn-line btn-sm" type="button" onClick={() => go(offsetDate(date, 1))} aria-label="Следующий день">
          →
        </button>
        {date !== localDate() && (
          <button className="btn btn-text btn-sm" type="button" onClick={() => go(localDate())}>
            Сегодня
          </button>
        )}
      </div>
      <Notice message={error} retry={load} />
      {!data && !error && <Loading />}
      {data && data.bookings.length === 0 && <p className="muted">В этот день записей нет.</p>}
      {grid}
    </main>
  );
}
