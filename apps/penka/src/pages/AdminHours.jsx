// Админка: часы работы по дням недели. От них зависят слоты брони и время заказа с собой.
import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Loading, Notice, PageHead } from '../components/ui.jsx';
import { WEEKDAYS_SHORT } from '../format.js';

const ORDER = [1, 2, 3, 4, 5, 6, 0]; // с понедельника

export function AdminHours({ demo }) {
  const [days, setDays] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/hours')
      .then((data) => setDays(data.days.map((d) => ({ ...d, closed: !d.opens, opens: d.opens || '09:00', closes: d.closes || '21:00' }))))
      .catch((e) => setError(e.message));
  }, []);

  function change(weekday, field, value) {
    setDays((list) => list.map((d) => (d.weekday === weekday ? { ...d, [field]: value } : d)));
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await api('/admin/hours', 'PUT', { days });
      setSuccess('Часы работы сохранены. Сайт уже показывает новые.');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!days) return error ? <Notice type="error">{error}</Notice> : <Loading />;

  return (
    <>
      <PageHead eyebrow="Настройки" title="Часы работы" />
      <p className="muted">Последняя бронь — за 1,5 часа до закрытия, заказ с собой — за 15 минут.</p>
      {demo && <Notice>Демо: часы можно посмотреть, а сохранить нельзя.</Notice>}
      <Notice type="error" onClose={() => setError('')}>{error}</Notice>
      <Notice type="success" onClose={() => setSuccess('')}>{success}</Notice>
      <form className="card hours-form" onSubmit={save}>
        {ORDER.map((weekday) => {
          const d = days.find((x) => x.weekday === weekday);
          return (
            <div key={weekday} className={`hours-row${d.closed ? ' hours-row--closed' : ''}`}>
              <b>{WEEKDAYS_SHORT[weekday]}</b>
              <input type="time" step="900" value={d.opens} disabled={d.closed} onChange={(e) => change(weekday, 'opens', e.target.value)} aria-label={`${WEEKDAYS_SHORT[weekday]}: открытие`} />
              <span>—</span>
              <input type="time" step="900" value={d.closes} disabled={d.closed} onChange={(e) => change(weekday, 'closes', e.target.value)} aria-label={`${WEEKDAYS_SHORT[weekday]}: закрытие`} />
              <label>
                <input type="checkbox" checked={d.closed} onChange={(e) => change(weekday, 'closed', e.target.checked)} /> выходной
              </label>
            </div>
          );
        })}
        <button type="submit" className="btn" disabled={busy}>
          {busy ? 'Сохраняем…' : 'Сохранить'}
        </button>
      </form>
    </>
  );
}
