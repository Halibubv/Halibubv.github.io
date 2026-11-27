// Кабинет: профиль. Имя и телефон, смена пароля (нужен текущий пароль).
import React, { useState } from 'react';
import { api } from '../../api.js';
import { Field, PageHead } from '../../components/ui.jsx';
import { formatPhone } from '../../format.js';

function ProfileForm({ user, onUpdate }) {
  const [values, setValues] = useState({ name: user.name, phone: user.phone || '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  function change(event) {
    const { name } = event.target;
    const value = name === 'phone' ? formatPhone(event.target.value) : event.target.value;
    setValues((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => ({ ...previous, [name]: '' }));
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const data = await api('/profile', 'PUT', { name: values.name.trim(), phone: values.phone });
      onUpdate(data.user);
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
      <h2>Контакты</h2>
      <Field label="Email" name="email" value={user.email} disabled hint="Email — это логин, его не меняем" />
      <Field label="Имя" name="name" value={values.name} onChange={change} error={errors.name} autoComplete="name" />
      <Field label="Телефон" name="phone" value={values.phone} onChange={change} error={errors.phone} inputMode="tel" autoComplete="tel" />
      {message && <p className="form-message" role="status">{message}</p>}
      <button className="btn btn-red" type="submit" disabled={busy}>
        {busy ? 'Сохраняем…' : 'Сохранить'}
      </button>
    </form>
  );
}

function PasswordForm({ user, demo }) {
  const empty = { current_password: '', password: '', passwordAgain: '' };
  const [values, setValues] = useState(empty);
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
    if (!values.current_password) formErrors.current_password = 'Введите текущий пароль.';
    if (values.password.length < 8) formErrors.password = 'Новый пароль — от 8 символов.';
    if (values.password !== values.passwordAgain) formErrors.passwordAgain = 'Пароли не совпадают.';
    if (Object.keys(formErrors).length) {
      setErrors(formErrors);
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await api('/profile/password', 'PUT', { current_password: values.current_password, password: values.password });
      setValues(empty);
      setMessage('Пароль изменён.');
    } catch (error) {
      setErrors(error.fields || {});
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel" onSubmit={submit} noValidate>
      <h2>Пароль</h2>
      {demo && user.is_demo && (
        <p className="muted small">Это общий демо-аккаунт: смену пароля сервер не примет.</p>
      )}
      <Field label="Текущий пароль" name="current_password" type="password" value={values.current_password}
        onChange={change} error={errors.current_password} autoComplete="current-password" />
      <Field label="Новый пароль" name="password" type="password" value={values.password}
        onChange={change} error={errors.password} autoComplete="new-password" hint="От 8 символов" />
      <Field label="Новый пароль ещё раз" name="passwordAgain" type="password" value={values.passwordAgain}
        onChange={change} error={errors.passwordAgain} autoComplete="new-password" />
      {message && <p className="form-message" role="status">{message}</p>}
      <button className="btn btn-line" type="submit" disabled={busy}>
        {busy ? 'Меняем…' : 'Сменить пароль'}
      </button>
    </form>
  );
}

export function Profile({ user, demo, onUpdate }) {
  return (
    <main className="wrap page">
      <PageHead number="03" kicker="Кабинет" title="Профиль" />
      <div className="two-col">
        <ProfileForm user={user} onUpdate={onUpdate} />
        <PasswordForm user={user} demo={demo} />
      </div>
    </main>
  );
}
