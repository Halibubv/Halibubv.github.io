// Админка: записи. Фильтры по дате (от–до), статусу и поиск по имени или телефону.
// Фильтры хранятся в адресе (?from=...&status=...), чтобы ссылку можно было открыть снова.
import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../api.js';
import { DemoBadge, Loading, Notice, PageHead, StatusBadge } from '../../components/ui.jsx';
import { STATUS_LABELS, carLabel, dateLabel, localDate, rub, timeLabel } from '../../format.js';

export function AdminBookings() {
  const [params, setParams] = useSearchParams();
  // По умолчанию — записи с сегодняшнего дня.
  const filters = {
    from: params.get('from') ?? localDate(),
    to: params.get('to') ?? '',
    status: params.get('status') ?? '',
    q: params.get('q') ?? '',
  };
  const [search, setSearch] = useState(filters.q);
  const [bookings, setBookings] = useState(null);
  const [error, setError] = useState('');
  const query = new URLSearchParams(filters).toString();

  function load() {
    setError('');
    setBookings(null);
    api('/admin/bookings?' + query)
      .then((data) => setBookings(data.bookings))
      .catch((loadError) => setError(loadError.message));
  }
  useEffect(load, [query]);

  function setFilter(name, value) {
    const next = { ...filters, [name]: value };
    setParams(next, { replace: true });
  }

  function submitSearch(event) {
    event.preventDefault();
    setFilter('q', search.trim());
  }

  return (
    <main className="wrap page">
      <PageHead number="02" kicker="Админка" title="Записи" />
      <form className="filters panel" onSubmit={submitSearch}>
        <label className="field">
          <span className="field-label">С даты</span>
          <input type="date" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">По дату</span>
          <input type="date" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Статус</span>
          <select value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
            <option value="">Все</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field filters-search">
          <span className="field-label">Имя или телефон</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Иван или 999 12" />
        </label>
        <div className="filters-actions">
          <button className="btn btn-red btn-sm" type="submit">
            Найти
          </button>
          <button
            className="btn btn-text btn-sm"
            type="button"
            onClick={() => {
              setSearch('');
              setParams({ from: '', to: '', status: '', q: '' }, { replace: true });
            }}
          >
            Все записи
          </button>
        </div>
      </form>

      <Notice message={error} retry={load} />
      {!bookings && !error && <Loading />}
      {bookings && (
        <p className="muted small">
          Найдено: {bookings.length}
          {bookings.length === 300 ? ' (показаны первые 300, уточните фильтр)' : ''}
        </p>
      )}
      {bookings && bookings.length === 0 && <p className="muted">По этим фильтрам записей нет.</p>}
      {bookings && bookings.length > 0 && (
        <div className="table" role="table" aria-label="Записи">
          <div className="table-row table-head" role="row">
            <span role="columnheader">№</span>
            <span role="columnheader">Когда</span>
            <span role="columnheader">Клиент</span>
            <span role="columnheader">Машина и услуги</span>
            <span role="columnheader">Сумма</span>
            <span role="columnheader">Статус</span>
          </div>
          {bookings.map((booking) => (
            <Link key={booking.id} className="table-row" role="row" to={`/admin/bookings/${booking.id}`}>
              <span className="mono muted" role="cell">
                {booking.number}
              </span>
              <span role="cell">
                <b>{dateLabel(booking.starts_at)}</b>
                <small className="mono">
                  {timeLabel(booking.starts_at)}–{timeLabel(booking.ends_at)}
                </small>
              </span>
              <span role="cell">
                <b>{booking.customer_name}</b>
                <small className="mono">{booking.phone}</small>
              </span>
              <span role="cell">
                <b>{carLabel(booking)}</b>
                <small>{booking.items.map((item) => item.name).join(', ')}</small>
              </span>
              <span className="mono" role="cell">
                {rub(booking.total)}
              </span>
              <span role="cell" className="table-status">
                <StatusBadge status={booking.status} />
                <DemoBadge show={booking.is_demo} />
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
