// Кабинет: мои брони — ближайшие и прошлые. Отменить можно не позже чем за час.
import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Empty, Loading, Notice, PageHead, StatusBadge } from '../components/ui.jsx';
import { RESERVATION_STATUS, ZONES, day, longDay, plural, time } from '../format.js';

function ReservationCard({ reservation, onCancel, busy }) {
  const r = reservation;
  return (
    <article className={`card booking${r.upcoming ? '' : ' booking--past'}`}>
      <div className="booking__date">
        <b>{day(r.starts_at, { words: false }).split(' ')[0]}</b>
        <span>{day(r.starts_at, { words: false }).split(' ')[1]}</span>
      </div>
      <div className="booking__body">
        <p className="booking__title">
          {longDay(r.starts_at.slice(0, 10))}, {time(r.starts_at)}–{time(r.ends_at)}
        </p>
        <p className="muted">
          {r.guests} {plural(r.guests, 'гость', 'гостя', 'гостей')} · столик № {r.table_label}, {ZONES[r.zone]}
        </p>
        {r.comment && <p className="booking__comment">«{r.comment}»</p>}
      </div>
      <div className="booking__side">
        <StatusBadge status={r.status} labels={RESERVATION_STATUS} />
        {r.can_cancel && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => onCancel(r)} disabled={busy}>
            Отменить
          </button>
        )}
        {r.upcoming && !r.can_cancel && ['new', 'confirmed'].includes(r.status) && (
          <small className="muted">До начала меньше часа — отменить можно по телефону.</small>
        )}
      </div>
    </article>
  );
}

export function AccountReservations() {
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/account/reservations')
      .then((data) => setList(data.reservations))
      .catch((e) => setError(e.message));
  }, []);

  async function cancel(reservation) {
    if (!window.confirm(`Отменить бронь на ${day(reservation.starts_at)}, ${time(reservation.starts_at)}?`)) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const data = await api(`/account/reservations/${reservation.id}/cancel`, 'POST');
      setList(data.reservations);
      setSuccess('Бронь отменена. Будем ждать вас в другой раз.');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const upcoming = (list || []).filter((r) => r.upcoming).reverse(); // ближайшая — первой
  const past = (list || []).filter((r) => !r.upcoming);

  return (
    <>
      <PageHead eyebrow="Личный кабинет" title="Мои брони">
        <a className="btn btn--sm" href="/#book">
          Забронировать столик
        </a>
      </PageHead>
      <Notice type="error" onClose={() => setError('')}>{error}</Notice>
      <Notice type="success" onClose={() => setSuccess('')}>{success}</Notice>
      {!list && !error && <Loading />}
      {list && (
        <>
          <h2 className="section-title">Ближайшие</h2>
          {upcoming.length ? (
            <div className="stack">
              {upcoming.map((r) => (
                <ReservationCard key={r.id} reservation={r} onCancel={cancel} busy={busy} />
              ))}
            </div>
          ) : (
            <Empty title="Ближайших броней нет">
              <p>Выберите день и время на сайте — столик подберём сами.</p>
            </Empty>
          )}
          {past.length > 0 && (
            <>
              <h2 className="section-title">Прошлые и отменённые</h2>
              <div className="stack">
                {past.map((r) => (
                  <ReservationCard key={r.id} reservation={r} onCancel={cancel} busy={busy} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
