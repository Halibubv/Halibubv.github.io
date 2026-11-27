// Общие части разметки: демо-плашка, шапка с разделами кабинета или админки, подвал.
import React from 'react';
import { NavLink } from 'react-router-dom';

// Разделы кабинета клиента и админки. end — подсвечивать только точный адрес.
const accountLinks = [
  { to: '/account', label: 'Мои записи', end: true },
  { to: '/account/garage', label: 'Гараж' },
  { to: '/account/profile', label: 'Профиль' },
];
const adminLinks = [
  { to: '/admin', label: 'Сводка', end: true },
  { to: '/admin/bookings', label: 'Записи' },
  { to: '/admin/schedule', label: 'Расписание' },
  { to: '/admin/services', label: 'Прайс' },
  { to: '/admin/clients', label: 'Клиенты' },
  { to: '/admin/settings', label: 'Настройки' },
];

// Логотип ведёт на лендинг. Это обычная ссылка, а не переход React Router:
// лендинг — отдельная страница сервера, а не часть React-приложения.
export function Logo() {
  return (
    <a className="logo" href="/" aria-label="ОБОРОТ, на главную">
      <i />
      ОБОРОТ
    </a>
  );
}

export function DemoBar({ demo }) {
  return (
    <div className="demo-bar">
      <b>ДЕМО</b> · Учебный проект для портфолио. Компания «Оборот» вымышленная.
      {demo
        ? ' Данные демонстрационные и пересоздаются при перезапуске сервера.'
        : ' Записи сохраняются в демонстрационную базу.'}
    </div>
  );
}

// Шапка. area = 'account' | 'admin' — какие разделы показать под логотипом.
export function Header({ user, area, onLogout, busy }) {
  const links = area === 'admin' ? adminLinks : accountLinks;
  return (
    <header className="app-header">
      <div className="wrap app-header-top">
        <Logo />
        <span className="area-label">{area === 'admin' ? 'Админка' : 'Кабинет'}</span>
        <div className="header-user">
          {user.role === 'admin' && area !== 'admin' && (
            <NavLink className="header-link" to="/admin">
              Админка
            </NavLink>
          )}
          {area === 'admin' && (
            <NavLink className="header-link" to="/account">
              Мой кабинет
            </NavLink>
          )}
          <a className="header-link" href="/#book">
            Записаться
          </a>
          <span className="header-name" title={user.email}>
            {user.name}
          </span>
          <button className="btn btn-line btn-sm" type="button" onClick={onLogout} disabled={busy}>
            {busy ? 'Выходим…' : 'Выйти'}
          </button>
        </div>
      </div>
      <nav className="subnav" aria-label={area === 'admin' ? 'Разделы админки' : 'Разделы кабинета'}>
        <div className="wrap subnav-list">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end}>
              {link.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="app-footer">
      <div className="wrap">
        <span>© ОБОРОТ — вымышленная компания, демо-проект для портфолио</span>
        <span>
          <a href="/">На сайт</a> · <a href="https://halibubv.github.io/">Все работы</a>
        </span>
      </div>
    </footer>
  );
}
