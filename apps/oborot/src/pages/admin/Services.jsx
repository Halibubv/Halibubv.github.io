// Админка: прайс. Услуги: название, описание, базовая цена (для седана), часы, порядок,
// показ на сайте. Услугу, которая есть в записях, удалить нельзя — только скрыть.
// В демо-режиме сервер не даст ничего изменить (403), здесь мы об этом предупреждаем.
import React, { useEffect, useState } from 'react';
import { api, errorText } from '../../api.js';
import { Field, Loading, Notice, PageHead } from '../../components/ui.jsx';
import { hoursLabel, rub } from '../../format.js';

const emptyService = { name: '', description: '', base_price: '', hours: '', sort: '100', is_active: true, code: '' };

function ServiceForm({ initial, onSave, onClose }) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  function change(event) {
    const { name, type, checked, value } = event.target;
    setValues((previous) => ({ ...previous, [name]: type === 'checkbox' ? checked : value }));
    setErrors((previous) => ({ ...previous, [name]: '' }));
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await onSave(values);
    } catch (error) {
      setErrors(error.fields || {});
      setMessage(error.message);
      setBusy(false);
    }
  }

  return (
    <form className="panel" onSubmit={submit} noValidate>
      <h2>{initial.id ? 'Изменить услугу' : 'Новая услуга'}</h2>
      <div className="form-grid">
        <Field label="Название" name="name" value={values.name} onChange={change} error={errors.name} />
        <Field label="Описание" name="description" value={values.description} onChange={change} error={errors.description} />
        <Field label="Цена для седана, ₽" name="base_price" inputMode="numeric" value={values.base_price} onChange={change} error={errors.base_price} />
        <Field label="Часы работы" name="hours" inputMode="decimal" value={values.hours} onChange={change} error={errors.hours} hint="Например, 1,5" />
        <Field label="Порядок" name="sort" inputMode="numeric" value={values.sort} onChange={change} error={errors.sort} hint="Меньше — выше в списке" />
        {!initial.id && (
          <Field label="Код (латиницей)" name="code" value={values.code} onChange={change} error={errors.code} hint="Необязательно" />
        )}
      </div>
      <label className="check">
        <input type="checkbox" name="is_active" checked={values.is_active} onChange={change} />
        Показывать на сайте
      </label>
      {message && <p className="form-error" role="alert">{message}</p>}
      <div className="form-actions">
        <button className="btn btn-red" type="submit" disabled={busy}>
          {busy ? 'Сохраняем…' : 'Сохранить'}
        </button>
        <button className="btn btn-line" type="button" onClick={onClose}>
          Отмена
        </button>
      </div>
    </form>
  );
}

export function Services({ demo }) {
  const [services, setServices] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(null);

  function load() {
    setError('');
    api('/admin/services')
      .then((data) => setServices(data.services))
      .catch((loadError) => setError(loadError.message));
  }
  useEffect(load, []);

  async function save(values) {
    const body = { ...values, hours: String(values.hours).replace(',', '.') };
    const data = values.id
      ? await api(`/admin/services/${values.id}`, 'PUT', body)
      : await api('/admin/services', 'POST', body);
    setServices(data.services);
    setEditing(null);
    setMessage('Прайс сохранён.');
  }

  async function toggle(service) {
    setMessage('');
    try {
      const data = await api(`/admin/services/${service.id}`, 'PUT', { ...service, is_active: !service.is_active });
      setServices(data.services);
    } catch (toggleError) {
      setMessage(errorText(toggleError));
    }
  }

  async function remove(service) {
    if (!window.confirm(`Удалить услугу «${service.name}»?`)) return;
    setMessage('');
    try {
      const data = await api(`/admin/services/${service.id}`, 'DELETE');
      setServices(data.services);
      setMessage('Услуга удалена.');
    } catch (removeError) {
      setMessage(errorText(removeError));
    }
  }

  return (
    <main className="wrap page">
      <PageHead number="04" kicker="Админка" title="Прайс">
        {!editing && (
          <button className="btn btn-red" type="button" onClick={() => setEditing(emptyService)}>
            Добавить услугу
          </button>
        )}
      </PageHead>
      {demo && (
        <Notice tone="info" message="Демо-режим: прайс можно посмотреть, но сохранить изменения сервер не даст." />
      )}
      <p className="muted small">
        Цены указаны для седана. Сайт сам умножит их на коэффициент кузова (× 1,2 кроссовер, × 1,4 внедорожник)
        и на 1,15 для премиум-марки. Старые записи хранят цену на момент записи.
      </p>
      <Notice message={error} retry={load} />
      <Notice message={message} tone="info" />
      {editing && (
        <ServiceForm
          key={editing.id || 'new'}
          initial={{ ...editing, base_price: String(editing.base_price), hours: String(editing.hours).replace('.', ','), sort: String(editing.sort) }}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}
      {!services && !error && <Loading />}
      {services && (
        <div className="table table--services" role="table" aria-label="Прайс">
          <div className="table-row table-head" role="row">
            <span role="columnheader">Услуга</span>
            <span role="columnheader">Цена</span>
            <span role="columnheader">Время</span>
            <span role="columnheader">На сайте</span>
            <span role="columnheader" />
          </div>
          {services.map((service) => (
            <div key={service.id} className={`table-row${service.is_active ? '' : ' is-hidden'}`} role="row">
              <span role="cell">
                <b>{service.name}</b>
                <small>
                  {service.description} · <span className="mono">{service.code}</span>
                  {service.used > 0 ? ` · в записях: ${service.used}` : ''}
                </small>
              </span>
              <span className="mono" role="cell">{rub(service.base_price)}</span>
              <span className="mono" role="cell">{hoursLabel(service.hours)}</span>
              <span role="cell">{service.is_active ? 'Показана' : 'Скрыта'}</span>
              <span role="cell" className="table-actions">
                <button className="btn btn-line btn-sm" type="button" onClick={() => setEditing(service)}>
                  Изменить
                </button>
                <button className="btn btn-text btn-sm" type="button" onClick={() => toggle(service)}>
                  {service.is_active ? 'Скрыть' : 'Показать'}
                </button>
                {service.used === 0 && (
                  <button className="btn btn-text btn-sm" type="button" onClick={() => remove(service)}>
                    Удалить
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
