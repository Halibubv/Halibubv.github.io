// Кабинет: гараж. Машины клиента: добавить, изменить, удалить.
// Машину с будущими записями сервер удалить не даст (ответ 409).
import React, { useEffect, useState } from 'react';
import { api, errorText } from '../../api.js';
import { Empty, Field, Loading, Notice, PageHead } from '../../components/ui.jsx';
import { BODIES } from '../../format.js';

const emptyCar = { brand: '', model: '', body: 'sedan', year: '', plate: '' };

function CarForm({ initial, brands, onSave, onClose }) {
  const [values, setValues] = useState(initial);
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
    const formErrors = {};
    if (!values.brand) formErrors.brand = 'Выберите марку.';
    if (!values.model.trim()) formErrors.model = 'Введите модель.';
    if (values.year && !/^\d{4}$/.test(values.year)) formErrors.year = 'Год — четыре цифры.';
    if (Object.keys(formErrors).length) {
      setErrors(formErrors);
      return;
    }
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
    <form className="panel car-form" onSubmit={submit} noValidate>
      <h2>{initial.id ? 'Изменить машину' : 'Новая машина'}</h2>
      <div className="form-grid">
        <Field label="Марка" name="brand" as="select" value={values.brand} onChange={change} error={errors.brand}>
          <option value="">Выберите…</option>
          {brands.map((brand) => (
            <option key={brand.id} value={brand.name}>
              {brand.name}
            </option>
          ))}
        </Field>
        <Field label="Модель" name="model" value={values.model} onChange={change} error={errors.model} placeholder="Camry" />
        <Field label="Год выпуска" name="year" inputMode="numeric" value={values.year ?? ''} onChange={change} error={errors.year} placeholder="2019" />
        <Field label="Госномер" name="plate" value={values.plate ?? ''} onChange={change} error={errors.plate} hint="Необязательно" />
      </div>
      <fieldset className="radio-row">
        <legend>Кузов</legend>
        {BODIES.map((body) => (
          <label key={body.id} className={`radio-chip${values.body === body.id ? ' is-on' : ''}`}>
            <input type="radio" name="body" value={body.id} checked={values.body === body.id} onChange={change} />
            {body.name}
          </label>
        ))}
      </fieldset>
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

export function Garage() {
  const [cars, setCars] = useState(null);
  const [brands, setBrands] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  // null — форма закрыта, объект — открыта (новая машина или изменение).
  const [editing, setEditing] = useState(null);

  function load() {
    setError('');
    Promise.all([api('/account/cars'), api('/catalog')])
      .then(([carData, catalog]) => {
        setCars(carData.cars);
        setBrands(catalog.brands);
      })
      .catch((loadError) => setError(loadError.message));
  }
  useEffect(load, []);

  async function save(values) {
    const body = { ...values, year: values.year === '' || values.year === null ? null : values.year };
    const data = values.id
      ? await api(`/account/cars/${values.id}`, 'PUT', body)
      : await api('/account/cars', 'POST', body);
    setCars(data.cars);
    setEditing(null);
    setMessage(values.id ? 'Машина сохранена.' : 'Машина добавлена в гараж.');
  }

  async function remove(car) {
    if (!window.confirm(`Удалить ${car.brand} ${car.model} из гаража?`)) return;
    setMessage('');
    try {
      const data = await api(`/account/cars/${car.id}`, 'DELETE');
      setCars(data.cars);
      setMessage('Машина удалена.');
    } catch (removeError) {
      setMessage(errorText(removeError));
    }
  }

  return (
    <main className="wrap page">
      <PageHead number="02" kicker="Кабинет" title="Гараж">
        {cars && cars.length > 0 && !editing && (
          <button className="btn btn-red" type="button" onClick={() => setEditing(emptyCar)}>
            Добавить машину
          </button>
        )}
      </PageHead>
      <Notice message={error} retry={load} />
      <Notice message={message} tone="info" />
      {!cars && !error && <Loading />}
      {editing && (
        <CarForm
          key={editing.id || 'new'}
          initial={{ ...editing, year: editing.year ?? '', plate: editing.plate ?? '' }}
          brands={brands}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}
      {cars && cars.length === 0 && !editing && (
        <Empty
          title="В гараже пусто"
          detail="Добавьте машину, и при записи не придётся заново выбирать марку и кузов."
          action="Добавить машину"
          onAction={() => setEditing(emptyCar)}
        />
      )}
      {cars && cars.length > 0 && (
        <div className="cards cars">
          {cars.map((car) => (
            <article key={car.id} className="car-card">
              <span className="mono car-plate">{car.plate || 'без номера'}</span>
              <h3>
                {car.brand} {car.model}
              </h3>
              <p>
                {car.body_name}
                {car.year ? ` · ${car.year}` : ''}
              </p>
              {car.future_bookings > 0 && (
                <p className="muted small">Будущих записей: {car.future_bookings}. Удалить нельзя, пока они есть.</p>
              )}
              <div className="form-actions">
                <button className="btn btn-line btn-sm" type="button" onClick={() => setEditing(car)}>
                  Изменить
                </button>
                <button className="btn btn-text btn-sm" type="button" onClick={() => remove(car)}>
                  Удалить
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
