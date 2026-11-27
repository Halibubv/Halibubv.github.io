// Кабинет: мои записи — ближайшие и прошлые. Отмена записи не позже чем за 2 часа до начала.
import React, { useEffect, useState } from 'react';
import { api, errorText } from '../../api.js';
import { DemoBadge, Empty, Loading, Notice, PageHead, StatusBadge } from '../../components/ui.jsx';
import { bookingWhen, carLabel, hoursLabel, parseDateTime, rub } from '../../format.js';

export function BookingItems({ booking }) {
  return (
    <ul className="items">
      {booking.items.map((item, index) => (
        <li key={index}>
          <span>{item.name}</span>
          <span className="mono">{rub(item.price)}</span>
        </li>
      ))}
      {booking.discount > 0 && (
        <li className="items-discount">
          <span>Скидка от 3 услуг</span>
          <span className="mono">−{rub(booking.discount)}</span>
        </li>
      )}
    </ul>
  );
}

function BookingCard({ booking, onCancel, busy }) {
  return (
    <article className={`booking-card booking-card--${booking.status}`}>
      <div className="booking-card-head">
        <span className="mono booking-num">№ {booking.number}</span>
        <StatusBadge status={booking.status} />
        <DemoBadge show={booking.is_demo} />
      </div>
      <h3>{bookingWhen(booking)}</h3>
      <p className="booking-car">{carLabel(booking)}</p>
      <BookingItems booking={booking} />
      <div className="booking-total">
        <span>
          Итого <small>≈ {hoursLabel(booking.hours)}</small>
        </span>
        <b className="mono">{rub(booking.total)}</b>
      </div>
      {booking.can_cancel && (
        <button className="btn btn-line btn-sm" type="button" disabled={busy} onClick={() => onCancel(booking)}>
          {busy ? 'Отменяем…' : 'Отменить запись'}
        </button>
      )}
      {!booking.can_cancel && ['new', 'confirmed'].includes(booking.status) && (
        <p className="muted small">До начала меньше 2 часов: отменить можно только по телефону.</p>
      )}
    </article>
  );
}

export function MyBookings() {
  const [bookings, setBookings] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState(null);

  function load() {
    setError('');
    api('/account/bookings')
      .then((data) => setBookings(data.bookings))
      .catch((loadError) => setError(loadError.message));
  }
  useEffect(load, []);

  async function cancel(booking) {
    if (!window.confirm(`Отменить запись № ${booking.number}?`)) return;
    setBusyId(booking.id);
    setMessage('');
    try {
      await api(`/account/bookings/${booking.id}/cancel`, 'POST');
      setMessage(`Запись № ${booking.number} отменена.`);
      load();
    } catch (cancelError) {
      setMessage(errorText(cancelError));
    } finally {
      setBusyId(null);
    }
  }

  const now = new Date();
  const upcoming = (bookings || [])
    .filter((b) => parseDateTime(b.ends_at) > now && ['new', 'confirmed', 'in_work'].includes(b.status))
    .reverse();
  const past = (bookings || []).filter((b) => !upcoming.includes(b));

  return (
    <main className="wrap page">
      <PageHead number="01" kicker="Кабинет" title="Мои записи">
        <a className="btn btn-red" href="/#calc">
          Записаться <span className="arr">→</span>
        </a>
      </PageHead>
      <Notice message={error} retry={load} />
      <Notice message={message} tone="info" />
      {!bookings && !error && <Loading />}
      {bookings && bookings.length === 0 && (
        <Empty
          title="Записей пока нет"
          detail="Выберите услуги в калькуляторе на главной и удобное время: запись появится здесь."
          action="Записаться"
          href="/#calc"
        />
      )}
      {upcoming.length > 0 && (
        <section className="block">
          <h2 className="block-title">Ближайшие</h2>
          <div className="cards">
            {upcoming.map((booking) => (
              <BookingCard key={booking.id} booking={booking} onCancel={cancel} busy={busyId === booking.id} />
            ))}
          </div>
        </section>
      )}
      {past.length > 0 && (
        <section className="block">
          <h2 className="block-title">Прошлые и отменённые</h2>
          <div className="cards">
            {past.map((booking) => (
              <BookingCard key={booking.id} booking={booking} onCancel={cancel} busy={busyId === booking.id} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
