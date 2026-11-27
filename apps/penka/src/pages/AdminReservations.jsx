// Админка: брони на выбранный день. Смена статуса и пересадка за другой свободный столик.
import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Empty, Loading, Notice, PageHead, StatusBadge } from '../components/ui.jsx';
import { RESERVATION_STATUS, ZONES, day, longDay, moscowToday, plural, time } from '../format.js';

// Кнопки статусов: куда можно перевести бронь (так же проверяет сервер).
const ACTIONS = {
  new: [['confirmed', 'Подтвердить'], ['no_show', 'Не пришли'], ['cancelled', 'Отменить']],
  confirmed: [['seated', 'Гости пришли'], ['no_show', 'Не пришли'], ['cancelled', 'Отменить']],
  seated: [['closed', 'Завершить']],
};

function shiftDate(date, days) {
  const [y, m, d] = date.split('-').map(Number);
  const next = new Date(y, m - 1, d + days);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
}

function MoveTable({ reservation, onMoved, onError }) {
  const [tables, setTables] = useState(null);
  const [choice, setChoice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/admin/reservations/${reservation.id}/free-tables`)
      .then((data) => setTables(data.tables))
      .catch((e) => onError(e.message));
  }, [reservation.id]);

  async function move() {
    setBusy(true);
    try {
      await api(`/admin/reservations/${reservation.id}/table`, 'POST', { table_id: Number(choice) });
      onMoved();
    } catch (e) {
      onError(e.message);
      setBusy(false);
    }
  }

  if (!tables) return <small className="muted">Ищем свободные столики…</small>;
  if (!tables.length) return <small className="muted">На это время других свободных столиков нет.</small>;
  return (
    <div className="move">
      <select value={choice} onChange={(e) => setChoice(e.target.value)} aria-label="Новый столик">
        <option value="">Выберите столик</option>
        {tables.map((t) => (
          <option key={t.id} value={t.id}>
            № {t.label} — {t.seats} {plural(t.seats, 'место', 'места', 'мест')}, {t.zone_name}
          </option>
        ))}
      </select>
      <button type="button" className="btn btn--sm" disabled={!choice || busy} onClick={move}>
        Пересадить
      </button>
    </div>
  );
}

export function AdminReservations() {
  const [date, setDate] = useState(moscowToday());
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [moving, setMoving] = useState(null);

  function load(forDate = date) {
    return api(`/admin/reservations?date=${forDate}`)
      .then((data) => setList(data.reservations))
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    setList(null);
    setMoving(null);
    load(date);
  }, [date]);

  async function changeStatus(r, status) {
    if (status === 'cancelled' && !window.confirm(`Отменить бронь ${r.customer_name} на ${time(r.starts_at)}?`)) return;
    setBusy(true);
    setError('');
    try {
      await api(`/admin/reservations/${r.id}/status`, 'POST', { status });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const guests = (list || []).filter((r) => ['new', 'confirmed', 'seated'].includes(r.status)).reduce((s, r) => s + r.guests, 0);

  return (
    <>
      <PageHead eyebrow="Бронь столиков" title={`Брони: ${day(date)}`}>
        <div className="date-nav">
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDate(shiftDate(date, -1))} aria-label="Предыдущий день">
            ←
          </button>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="День" />
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDate(shiftDate(date, 1))} aria-label="Следующий день">
            →
          </button>
          {date !== moscowToday() && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDate(moscowToday())}>
              Сегодня
            </button>
          )}
        </div>
      </PageHead>
      <p className="muted">
        {longDay(date)}
        {list && ` · ждём ${guests} ${plural(guests, 'гостя', 'гостей', 'гостей')}`}
      </p>
      <Notice type="error" onClose={() => setError('')}>{error}</Notice>
      {!list && <Loading />}
      {list && !list.length && <Empty title="На этот день броней нет" />}
      {list && list.length > 0 && (
        <div className="stack">
          {list.map((r) => (
            <article key={r.id} className={`card res${['closed', 'cancelled', 'no_show'].includes(r.status) ? ' res--past' : ''}`}>
              <div className="res__time">
                <b>{time(r.starts_at)}</b>
                <small>до {time(r.ends_at)}</small>
              </div>
              <div className="res__body">
                <p className="res__who">
                  {r.customer_name} · <a href={`tel:${r.phone.replace(/[^\d+]/g, '')}`}>{r.phone}</a>
                  {!r.user_id && <span className="chip-note">без аккаунта</span>}
                </p>
                <p className="muted">
                  {r.guests} {plural(r.guests, 'гость', 'гостя', 'гостей')} · столик № {r.table_label} ({r.seats}{' '}
                  {plural(r.seats, 'место', 'места', 'мест')}, {ZONES[r.zone]})
                </p>
                {r.comment && <p className="booking__comment">«{r.comment}»</p>}
                {moving === r.id && <MoveTable reservation={r} onMoved={() => { setMoving(null); load(); }} onError={setError} />}
              </div>
              <div className="res__side">
                <StatusBadge status={r.status} labels={RESERVATION_STATUS} />
                <div className="res__actions">
                  {(ACTIONS[r.status] || []).map(([status, label]) => (
                    <button
                      key={status}
                      type="button"
                      className={`btn btn--sm${status === 'confirmed' || status === 'seated' || status === 'closed' ? '' : ' btn--ghost'}`}
                      disabled={busy}
                      onClick={() => changeStatus(r, status)}
                    >
                      {label}
                    </button>
                  ))}
                  {ACTIONS[r.status] && (
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => setMoving(moving === r.id ? null : r.id)}>
                      {moving === r.id ? 'Не пересаживать' : 'Пересадить'}
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
