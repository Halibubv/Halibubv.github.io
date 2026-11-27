// Админка: карточка записи. Клиент, машина, услуги и цены на момент записи,
// комментарий, история статусов и кнопки допустимых переходов.
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, errorText } from '../../api.js';
import { DemoBadge, Loading, Notice, PageHead, StatusBadge } from '../../components/ui.jsx';
import { STATUS_ACTIONS, bookingWhen, carLabel, dateTimeShort, hoursLabel, rub } from '../../format.js';
import { BookingItems } from '../account/MyBookings.jsx';

export function BookingCard() {
  const { id } = useParams();
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');

  function load() {
    setError('');
    api(`/admin/bookings/${id}`)
      .then((data) => setBooking(data.booking))
      .catch((loadError) => setError(loadError.message));
  }
  useEffect(load, [id]);

  async function changeStatus(status) {
    if (['cancelled', 'no_show'].includes(status) && !window.confirm(`${STATUS_ACTIONS[status]}? Вернуть статус будет нельзя.`)) {
      return;
    }
    setBusy(status);
    setMessage('');
    try {
      const data = await api(`/admin/bookings/${id}/status`, 'PUT', { status });
      setBooking(data.booking);
    } catch (statusError) {
      setMessage(errorText(statusError));
    } finally {
      setBusy('');
    }
  }

  return (
    <main className="wrap page">
      <Link className="back-link" to="/admin/bookings">
        ← Все записи
      </Link>
      <PageHead number="02" kicker="Запись" title={booking ? `№ ${booking.number}` : 'Запись'} />
      <Notice message={error} retry={load} />
      {!booking && !error && <Loading />}
      {booking && (
        <div className="detail">
          <section className="panel">
            <div className="booking-card-head">
              <StatusBadge status={booking.status} />
              <DemoBadge show={booking.is_demo} />
            </div>
            <h2 className="detail-when">{bookingWhen(booking)}</h2>
            <dl className="facts">
              <dt>Клиент</dt>
              <dd>
                {booking.customer_name}
                {booking.user_email ? <small> · аккаунт {booking.user_email}</small> : <small> · гость</small>}
              </dd>
              <dt>Телефон</dt>
              <dd>
                <a href={`tel:${booking.phone.replace(/[^\d+]/g, '')}`}>{booking.phone}</a>
              </dd>
              <dt>Машина</dt>
              <dd>
                {carLabel(booking)}
                {booking.car_year ? `, ${booking.car_year}` : ''}
                {booking.car_model && <small> · {booking.body_name}</small>}
              </dd>
              <dt>Работы</dt>
              <dd>≈ {hoursLabel(booking.hours)}, пост занят до {booking.ends_at.slice(11, 16)}</dd>
              <dt>Комментарий</dt>
              <dd>{booking.comment || <span className="muted">нет</span>}</dd>
            </dl>
            <h3 className="sub-title">Услуги и цены на момент записи</h3>
            <BookingItems booking={booking} />
            <div className="booking-total">
              <span>Итого</span>
              <b className="mono">{rub(booking.total)}</b>
            </div>
          </section>

          <aside className="panel">
            <h3 className="sub-title">Статус</h3>
            {booking.next_statuses.length === 0 && <p className="muted small">Запись закрыта, статус больше не меняется.</p>}
            <div className="status-actions">
              {booking.next_statuses.map((status) => (
                <button
                  key={status}
                  type="button"
                  className={`btn btn-sm ${['cancelled', 'no_show'].includes(status) ? 'btn-line' : 'btn-red'}`}
                  disabled={Boolean(busy)}
                  onClick={() => changeStatus(status)}
                >
                  {busy === status ? 'Сохраняем…' : STATUS_ACTIONS[status]}
                </button>
              ))}
            </div>
            <Notice message={message} />
            <h3 className="sub-title">История</h3>
            <ol className="history">
              {booking.events.map((event, index) => (
                <li key={index}>
                  <span className="mono">{dateTimeShort(event.created_at)}</span>
                  <b>{event.status_label}</b>
                  <small>
                    {event.user_name
                      ? `${event.user_role === 'admin' ? 'сотрудник' : 'клиент'}: ${event.user_name}`
                      : 'гость с сайта'}
                  </small>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      )}
    </main>
  );
}
