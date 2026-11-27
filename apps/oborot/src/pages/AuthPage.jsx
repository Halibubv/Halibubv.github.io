// Вход и регистрация (mode = 'login' или 'register').
// Когда включён демо-режим (сервер прислал demo: true), рядом с формой показаны демо-логины.
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Logo } from '../components/Layout.jsx';
import { Field } from '../components/ui.jsx';
import { formatPhone } from '../format.js';

const DEMO_ACCOUNTS = [
  { role: 'Клиент', email: 'client@oborot.demo', password: 'OborotClient2026', note: 'записи, гараж, отмена' },
  { role: 'Администратор', email: 'admin@oborot.demo', password: 'OborotAdmin2026', note: 'записи, расписание, прайс' },
];

const emptyValues = { name: '', email: '', phone: '', password: '', passwordAgain: '' };

// Проверка формы до отправки на сервер. Сервер проверит всё ещё раз.
function validate(values, isRegister) {
  const errors = {};
  if (isRegister && values.name.trim().length < 2) errors.name = 'Введите имя.';
  if (!/^\S+@\S+\.\S+$/.test(values.email.trim())) errors.email = 'Введите корректный email.';
  if (isRegister && values.phone.replace(/\D/g, '').length !== 11) errors.phone = 'Проверьте номер телефона.';
  if (!values.password) errors.password = 'Введите пароль.';
  if (isRegister) {
    const bytes = new TextEncoder().encode(values.password).length;
    if (bytes < 8 || bytes > 72) errors.password = 'Пароль должен содержать от 8 до 72 символов.';
    if (values.password !== values.passwordAgain) errors.passwordAgain = 'Пароли не совпадают.';
  }
  return errors;
}

export function AuthPage({ mode, demo, onAuth }) {
  const register = mode === 'register';
  const [values, setValues] = useState(emptyValues);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  // При переключении вход ↔ регистрация очищаем форму.
  useEffect(() => {
    setValues(emptyValues);
    setErrors({});
    setMessage('');
  }, [mode]);

  function change(event) {
    const { name } = event.target;
    let { value } = event.target;
    if (name === 'phone') value = formatPhone(value);
    setValues((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => ({ ...previous, [name]: '' }));
  }

  async function submit(event) {
    event.preventDefault();
    const formErrors = validate(values, register);
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const body = { email: values.email.trim(), password: values.password };
      if (register) Object.assign(body, { name: values.name.trim(), phone: values.phone });
      const data = await api(register ? '/auth/register' : '/auth/login', 'POST', body);
      // App.jsx сам откроет кабинет или админку, когда узнает пользователя.
      onAuth(data.user);
    } catch (error) {
      setErrors(error.fields || {});
      setMessage(error.message);
      setBusy(false);
    }
  }

  function fillDemo(account) {
    setValues({ ...emptyValues, email: account.email, password: account.password });
    setErrors({});
    setMessage('');
  }

  return (
    <main className="auth">
      <section className="auth-side">
        <Logo />
        <h1>
          {register ? (
            <>
              Свой <span className="red">кабинет</span>
            </>
          ) : (
            <>
              С возвра<span className="red">щением</span>
            </>
          )}
        </h1>
        <p className="auth-lead">
          В кабинете — ваши записи и машины: можно отменить запись и не вводить данные машины
          при каждой записи. Записаться можно и без регистрации, на главной странице.
        </p>
        {demo && (
          <div className="demo-logins">
            <h2>Демо-доступ</h2>
            <p>Данные демонстрационные. Нажмите, чтобы подставить логин и пароль.</p>
            {DEMO_ACCOUNTS.map((account) => (
              <button key={account.email} type="button" className="demo-login" onClick={() => fillDemo(account)}>
                <b>{account.role}</b>
                <span className="mono">
                  {account.email} / {account.password}
                </span>
                <small>{account.note}</small>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="auth-form-wrap">
        <form className="panel auth-form" onSubmit={submit} noValidate>
          <div className="auth-switch">
            <span>{register ? 'Уже есть аккаунт?' : 'Нет аккаунта?'}</span>
            <Link to={register ? '/login' : '/register'}>{register ? 'Войти' : 'Зарегистрироваться'}</Link>
          </div>
          <h2>{register ? 'Регистрация' : 'Вход'}</h2>
          {register && (
            <Field label="Имя" name="name" value={values.name} onChange={change} error={errors.name} autoComplete="name" />
          )}
          <Field
            label="Email"
            name="email"
            type="email"
            value={values.email}
            onChange={change}
            error={errors.email}
            autoComplete="email"
          />
          {register && (
            <Field
              label="Телефон"
              name="phone"
              inputMode="tel"
              value={values.phone}
              onChange={change}
              error={errors.phone}
              autoComplete="tel"
              placeholder="+7 (___) ___-__-__"
            />
          )}
          <Field
            label="Пароль"
            name="password"
            type="password"
            value={values.password}
            onChange={change}
            error={errors.password}
            autoComplete={register ? 'new-password' : 'current-password'}
            hint={register ? 'От 8 символов' : undefined}
          />
          {register && (
            <Field
              label="Пароль ещё раз"
              name="passwordAgain"
              type="password"
              value={values.passwordAgain}
              onChange={change}
              error={errors.passwordAgain}
              autoComplete="new-password"
            />
          )}
          {message && (
            <p className="form-error" role="alert">
              {message}
            </p>
          )}
          <button className="btn btn-red btn-wide" type="submit" disabled={busy}>
            {busy ? 'Подождите…' : register ? 'Создать аккаунт' : 'Войти'} <span className="arr">→</span>
          </button>
          <a className="auth-back" href="/">
            ← На главную
          </a>
        </form>
      </section>
    </main>
  );
}
