// Кабинет: профиль (имя, телефон) и смена пароля.
import React, { useState } from 'react';
import { api } from '../api.js';
import { Field, Notice, PageHead } from '../components/ui.jsx';
import { formatPhone } from '../phone.js';

export function AccountProfile({ user, onUpdate, demo }) {
  const [profile, setProfile] = useState({ name: user.name, phone: user.phone || '' });
  const [profileState, setProfileState] = useState({ busy: false, error: '', success: '', fields: {} });
  const [password, setPassword] = useState({ current_password: '', password: '', again: '' });
  const [passwordState, setPasswordState] = useState({ busy: false, error: '', success: '', fields: {} });

  async function saveProfile(event) {
    event.preventDefault();
    setProfileState({ busy: true, error: '', success: '', fields: {} });
    try {
      const data = await api('/account/profile', 'PUT', profile);
      onUpdate(data.user);
      setProfileState({ busy: false, error: '', success: 'Сохранили.', fields: {} });
    } catch (e) {
      setProfileState({ busy: false, error: e.message, success: '', fields: e.fields || {} });
    }
  }

  async function savePassword(event) {
    event.preventDefault();
    if (password.password !== password.again) {
      setPasswordState({ busy: false, error: '', success: '', fields: { again: 'Пароли не совпадают.' } });
      return;
    }
    setPasswordState({ busy: true, error: '', success: '', fields: {} });
    try {
      await api('/account/password', 'PUT', { current_password: password.current_password, password: password.password });
      setPassword({ current_password: '', password: '', again: '' });
      setPasswordState({ busy: false, error: '', success: 'Пароль изменён.', fields: {} });
    } catch (e) {
      setPasswordState({ busy: false, error: e.message, success: '', fields: e.fields || {} });
    }
  }

  return (
    <>
      <PageHead eyebrow="Личный кабинет" title="Профиль" />
      {demo && (
        <Notice>Это демо. У общих демо-аккаунтов профиль и пароль менять нельзя — зарегистрируйтесь, чтобы попробовать.</Notice>
      )}
      <div className="two-cols">
        <form className="card form" onSubmit={saveProfile} noValidate>
          <h2 className="card__title">Имя и телефон</h2>
          <p className="muted">Подставим их в форму брони и в заказ.</p>
          <Notice type="error">{profileState.error}</Notice>
          <Notice type="success">{profileState.success}</Notice>
          <Field label="Email" value={user.email} readOnly disabledhint="Email — это логин, его не меняем." />
          <Field
            label="Имя"
            value={profile.name}
            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            error={profileState.fields.name}
            autoComplete="name"
          />
          <Field
            label="Телефон"
            type="tel"
            inputMode="tel"
            value={profile.phone}
            onChange={(e) => setProfile({ ...profile, phone: formatPhone(e.target.value) })}
            error={profileState.fields.phone}
            autoComplete="tel"
          />
          <button className="btn" type="submit" disabled={profileState.busy}>
            {profileState.busy ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </form>

        <form className="card form" onSubmit={savePassword} noValidate>
          <h2 className="card__title">Смена пароля</h2>
          <Notice type="error">{passwordState.error}</Notice>
          <Notice type="success">{passwordState.success}</Notice>
          <Field
            label="Текущий пароль"
            type="password"
            value={password.current_password}
            onChange={(e) => setPassword({ ...password, current_password: e.target.value })}
            error={passwordState.fields.current_password}
            autoComplete="current-password"
          />
          <Field
            label="Новый пароль"
            type="password"
            value={password.password}
            onChange={(e) => setPassword({ ...password, password: e.target.value })}
            error={passwordState.fields.password}
            hint="От 8 символов"
            autoComplete="new-password"
          />
          <Field
            label="Новый пароль ещё раз"
            type="password"
            value={password.again}
            onChange={(e) => setPassword({ ...password, again: e.target.value })}
            error={passwordState.fields.again}
            autoComplete="new-password"
          />
          <button className="btn" type="submit" disabled={passwordState.busy}>
            {passwordState.busy ? 'Меняем…' : 'Сменить пароль'}
          </button>
        </form>
      </div>
    </>
  );
}
