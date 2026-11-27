// Админка: столики. Схема зала — простая сетка карточек по зонам.
import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Field, Loading, Notice, PageHead, Switch } from '../components/ui.jsx';
import { ZONES, plural } from '../format.js';

const blank = { label: '', seats: 2, zone: 'window', is_active: true };

function TableForm({ table, onSaved, onCancel }) {
  const [values, setValues] = useState({ ...blank, ...table });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const body = { ...values, seats: Number(values.seats) };
    try {
      const data = table.id ? await api(`/admin/tables/${table.id}`, 'PUT', body) : await api('/admin/tables', 'POST', body);
      onSaved(data.tables);
    } catch (e) {
      setError(e.message);
      setErrors(e.fields || {});
      setBusy(false);
    }
  }

  return (
    <form className="card form" onSubmit={submit} noValidate>
      <h3 className="card__title">{table.id ? `Столик № ${table.label}` : 'Новый столик'}</h3>
      <Notice type="error">{error}</Notice>
      <div className="form-grid">
        <Field label="Номер" value={values.label} onChange={(e) => setValues({ ...values, label: e.target.value })} error={errors.label} />
        <Field label="Мест" type="number" min="1" max="12" value={values.seats} onChange={(e) => setValues({ ...values, seats: e.target.value })} error={errors.seats} />
        <Field as="select" label="Зона" value={values.zone} onChange={(e) => setValues({ ...values, zone: e.target.value })}>
          {Object.entries(ZONES).map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </Field>
      </div>
      <label className="checks">
        <input type="checkbox" checked={values.is_active} onChange={(e) => setValues({ ...values, is_active: e.target.checked })} /> принимает брони
      </label>
      <div className="form-actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Отмена
        </button>
        <button type="submit" className="btn" disabled={busy}>
          Сохранить
        </button>
      </div>
    </form>
  );
}

export function AdminTables({ demo }) {
  const [tables, setTables] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    api('/admin/tables')
      .then((data) => setTables(data.tables))
      .catch((e) => setError(e.message));
  }, []);

  async function toggle(table, active) {
    setError('');
    try {
      const data = await api(`/admin/tables/${table.id}`, 'PUT', { ...table, is_active: active });
      setTables(data.tables);
    } catch (e) {
      setError(e.message);
    }
  }

  if (!tables) return error ? <Notice type="error">{error}</Notice> : <Loading />;
  const seats = tables.filter((t) => t.is_active).reduce((s, t) => s + t.seats, 0);

  return (
    <>
      <PageHead eyebrow="Зал" title="Столики">
        <button type="button" className="btn btn--sm" onClick={() => setEditing({})}>
          + Столик
        </button>
      </PageHead>
      <p className="muted">
        {tables.length} {plural(tables.length, 'столик', 'столика', 'столиков')}, {seats} {plural(seats, 'место', 'места', 'мест')} для броней.
        Сервер сажает гостей за самый маленький свободный столик, где все поместятся.
      </p>
      {demo && <Notice>Демо: столики можно посмотреть, а менять их нельзя.</Notice>}
      <Notice type="error" onClose={() => setError('')}>{error}</Notice>
      {editing && (
        <TableForm
          table={editing}
          onCancel={() => setEditing(null)}
          onSaved={(list) => {
            setTables(list);
            setEditing(null);
          }}
        />
      )}
      {Object.entries(ZONES).map(([zone, name]) => {
        const inZone = tables.filter((t) => t.zone === zone);
        if (!inZone.length) return null;
        return (
          <section key={zone} className="hall-zone">
            <h2 className="section-title">{name}</h2>
            <div className="hall">
              {inZone.map((t) => (
                <article key={t.id} className={`table-card table-card--${t.zone}${t.is_active ? '' : ' table-card--off'}`}>
                  <span className="table-card__num">№ {t.label}</span>
                  <span className="table-card__seats" aria-label={`${t.seats} мест`}>
                    {Array.from({ length: t.seats }, (_, k) => (
                      <i key={k} />
                    ))}
                  </span>
                  <small>
                    {t.seats} {plural(t.seats, 'место', 'места', 'мест')}
                  </small>
                  <Switch checked={t.is_active} onChange={(v) => toggle(t, v)} label={t.is_active ? 'активен' : 'выключен'} />
                  <button type="button" className="link-btn" onClick={() => setEditing(t)}>
                    Изменить
                  </button>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
