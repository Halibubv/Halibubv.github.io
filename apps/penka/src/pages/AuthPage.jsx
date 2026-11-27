// Вход и регистрация (mode = 'login' или 'register').
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Logo } from '../components/Layout.jsx';
import { Field, Notice } from '../components/ui.jsx';
import { formatPhone } from '../phone.js';

const empty = { name: '', email: '', phone: '', password: '', passwordAgain: '' };

// Проверка до отправки. Сервер всё равно проверит заново.
function validate(values, isRegister) {
  const errors = {};
  if (isRegister && values.name.trim().length < 2) errors.name = 'Как к вам обращаться?';
  if (!/^\S+@\S+\.\S+$/.test(values.email.trim())) errors.email = 'Введите корректный email.';
  if (isRegister && values.phone.replace(/\D/g, '').length !== 11) errors.phone = 'Введите номер целиком: +7 и ещё 10 цифр.';
  const bytes = new TextEncoder().encode(values.password).length;
  if (isRegister && (bytes < 8 || bytes > 72)) errors.password = 'Пароль — от 8 символов.';
  if (!isRegister && !values.password) errors.password = 'Введите пароль.';
  if (isRegister && values.password !== values.passwordAgain) errors.passwordAgain = 'Пароли не совпадают.';
  return errors;
}

const ROLE_NAMES = { client: 'Гость кофейни', admin: 'Бариста (админка)' };

export function AuthPage({ mode, onAuth, demoLogins, sessionError, next }) {
  const register = mode === 'register';
  const [values, setValues] = useState(empty);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(sessionError || '');

  useEffect(() => {
    setErrors({});
    setMessage('');
  }, [mode]);

  function change(event) {
    const { name, value } = event.target;
    setValues((previous) => ({ ...previous, [name]: name === 'phone' ? formatPhone(value) : value }));
    setErrors((previous) => ({ ...previous, [name]: '' }));
  }

  async function submit(event) {
    event.preventDefault();
    const formErrors = validate(values, register);
    if (Object.keys(formErrors).length) {
      setErrors(formErrors);
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const data = await api(register ? '/auth/register' : '/auth/login', 'POST', {
        name: values.name.trim(),
        email: values.email.trim(),
        phone: values.phone,
        password: values.password,
      });
      onAuth(data.user);
    } catch (error) {
      setErrors(error.fields || {});
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  const nextQuery = next ? `?next=${encodeURIComponent(next)}` : '';

  return (
    <div className="auth">
      <div className="auth__visual">
        <img src="/img/interior.jpg" alt="" />
        <p className="auth__hand">
          брони, заказы с собой
          <br />и любимый столик у окна
        </p>
      </div>
      <main className="auth__side">
        <Logo />
        <h1>{register ? 'Регистрация' : 'Вход'}</h1>
        <p className="auth__lead">
          {register
            ? 'Аккаунт нужен, чтобы видеть свои брони и заказы и повторять любимый заказ в один клик. Бронировать можно и без него.'
            : 'Ваши брони, заказы с собой и профиль. Для сотрудников — админка кофейни.'}
        </p>

        {!register && demoLogins.length > 0 && (
          <div className="demo-logins">
            <p className="eyebrow">Демо-доступ</p>
            {demoLogins.map((login) => (
              <button
                type="button"
                key={login.email}
                className="demo-logins__item"
                onClick={() => setValues({ ...empty, email: login.email, password: login.password })}
              >
                <b>{ROLE_NAMES[login.role]}</b>
                <span>
                  {login.email} / {login.password}
                </span>
              </button>
            ))}
            <small>Нажмите, чтобы подставить логин и пароль.</small>
          </div>
        )}

        <Notice type="error">{message}</Notice>
        <form className="form" onSubmit={submit} noValidate>
          {register && (
            <Field label="Имя" name="name" value={values.name} onChange={change} error={errors.name} autoComplete="name" />
          )}
          <Field label="Email" name="email" type="email" value={values.email} onChange={change} error={errors.email} autoComplete="email" />
          {register && (
            <Field
              label="Телефон"
              name="phone"
              type="tel"
              inputMode="tel"
              placeholder="+7 (___) ___-__-__"
              value={values.phone}
              onChange={change}
              error={errors.phone}
              autoComplete="tel"
            />
          )}
          <Field
            label="Пароль"
            name="password"
            type="password"
            value={values.password}
            onChange={change}
            error={errors.password}
            hint={register ? 'От 8 символов' : ''}
            autoComplete={register ? 'new-password' : 'current-password'}
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
          <button className="btn btn--full" type="submit" disabled={busy}>
            {busy ? 'Подождите…' : register ? 'Создать аккаунт' : 'Войти'}
          </button>
        </form>
        <p className="auth__switch">
          {register ? 'Уже есть аккаунт? ' : 'Нет аккаунта? '}
          <Link to={(register ? '/login' : '/register') + nextQuery}>{register ? 'Войти' : 'Зарегистрироваться'}</Link>
        </p>
        <a className="auth__back" href="/">
          ← На сайт кофейни
        </a>
      </main>
    </div>
  );
}
