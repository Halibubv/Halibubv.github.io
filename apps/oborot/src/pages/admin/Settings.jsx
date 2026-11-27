// Админка: настройки — число постов, часы работы и марки (премиум или нет).
import React, { useEffect, useState } from 'react';
import { api, errorText } from '../../api.js';
import { Field, Loading, Notice, PageHead } from '../../components/ui.jsx';

function ScheduleForm({ settings, onSaved }) {
  const [values, setValues] = useState({
    posts: String(settings.posts),
    open_hour: String(settings.open_hour),
    close_hour: String(settings.close_hour),
  });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  function change(event) {
    const { name, value } = event.target;
    setValues((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => ({ ...previous, [name]: '' }));
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      onSaved(await api('/admin/settings', 'PUT', values));
      setMessage('Сохранено.');
    } catch (error) {
      setErrors(error.fields || {});
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel" onSubmit={submit} noValidate>
      <h2>Расписание</h2>
      <div className="form-grid form-grid--3">
        <Field label="Постов" name="posts" inputMode="numeric" value={values.posts} onChange={change} error={errors.posts} />
        <Field label="Открытие, час" name="open_hour" inputMode="numeric" value={values.open_hour} onChange={change} error={errors.open_hour} />
        <Field label="Закрытие, час" name="close_hour" inputMode="numeric" value={values.close_hour} onChange={change} error={errors.close_hour} />
      </div>
      <p className="muted small">Слоты записи — каждый час с открытия; работа должна закончиться до закрытия.</p>
      {message && <p className="form-message" role="status">{message}</p>}
      <button className="btn btn-red" type="submit" disabled={busy}>
        {busy ? 'Сохраняем…' : 'Сохранить'}
      </button>
    </form>
  );
}

function BrandRow({ brand, onSave, onDelete }) {
  const [values, setValues] = useState({ name: brand.name, is_premium: brand.is_premium, sort: String(brand.sort) });
  const changed = values.name !== brand.name || values.is_premium !== brand.is_premium || values.sort !== String(brand.sort);
  return (
    <div className="brand-row">
      <input aria-label="Название марки" value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} />
      <input aria-label="Порядок" className="brand-sort mono" inputMode="numeric" value={values.sort}
        onChange={(e) => setValues({ ...values, sort: e.target.value })} />
      <label className="check">
        <input type="checkbox" checked={values.is_premium} onChange={(e) => setValues({ ...values, is_premium: e.target.checked })} />
        Премиум +15%
      </label>
      <span className="brand-actions">
        {changed && (
          <button className="btn btn-red btn-sm" type="button" onClick={() => onSave(brand.id, values)}>
            Сохранить
          </button>
        )}
        <button className="btn btn-text btn-sm" type="button" onClick={() => onDelete(brand)}>
          Удалить
        </button>
      </span>
    </div>
  );
}

export function Settings({ demo }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [newBrand, setNewBrand] = useState({ name: '', is_premium: false, sort: '500' });

  function load() {
    setError('');
    api('/admin/settings')
      .then(setData)
      .catch((loadError) => setError(loadError.message));
  }
  useEffect(load, []);

  async function run(request, success) {
    setMessage('');
    try {
      setData(await request());
      setMessage(success);
      return true;
    } catch (requestError) {
      setMessage(errorText(requestError));
      return false;
    }
  }

  const saveBrand = (id, values) => run(() => api(`/admin/brands/${id}`, 'PUT', values), 'Марка сохранена.');
  const deleteBrand = (brand) =>
    window.confirm(`Удалить марку ${brand.name}?`) && run(() => api(`/admin/brands/${brand.id}`, 'DELETE'), 'Марка удалена.');
  async function addBrand(event) {
    event.preventDefault();
    if (await run(() => api('/admin/brands', 'POST', newBrand), 'Марка добавлена.')) {
      setNewBrand({ name: '', is_premium: false, sort: '500' });
    }
  }

  return (
    <main className="wrap page">
      <PageHead number="06" kicker="Админка" title="Настройки" />
      {demo && <Notice tone="info" message="Демо-режим: настройки и марки можно посмотреть, но сохранить изменения сервер не даст." />}
      <Notice message={error} retry={load} />
      {!data && !error && <Loading />}
      {data && (
        <div className="two-col">
          <ScheduleForm settings={data.settings} onSaved={setData} />
          <section className="panel">
            <h2>Марки</h2>
            <Notice message={message} tone="info" />
            <div className="brands">
              {data.brands.map((brand) => (
                <BrandRow key={`${brand.id}-${brand.name}-${brand.is_premium}-${brand.sort}`} brand={brand} onSave={saveBrand} onDelete={deleteBrand} />
              ))}
            </div>
            <form className="brand-row brand-row--new" onSubmit={addBrand}>
              <input aria-label="Новая марка" placeholder="Новая марка" value={newBrand.name}
                onChange={(e) => setNewBrand({ ...newBrand, name: e.target.value })} />
              <input aria-label="Порядок" className="brand-sort mono" inputMode="numeric" value={newBrand.sort}
                onChange={(e) => setNewBrand({ ...newBrand, sort: e.target.value })} />
              <label className="check">
                <input type="checkbox" checked={newBrand.is_premium}
                  onChange={(e) => setNewBrand({ ...newBrand, is_premium: e.target.checked })} />
                Премиум +15%
              </label>
              <span className="brand-actions">
                <button className="btn btn-line btn-sm" type="submit" disabled={!newBrand.name.trim()}>
                  Добавить
                </button>
              </span>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
