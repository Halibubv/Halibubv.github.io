// Шапка кабинета и админки: логотип (ведёт на лендинг), вкладки разделов, имя и «Выйти».
import React from 'react';
import { NavLink } from 'react-router-dom';

const accountTabs = [
  { to: '/account', label: 'Брони', end: true },
  { to: '/account/orders', label: 'Заказы' },
  { to: '/account/profile', label: 'Профиль' },
];

const adminTabs = [
  { to: '/admin', label: 'Сегодня', end: true },
  { to: '/admin/orders', label: 'Заказы' },
  { to: '/admin/reservations', label: 'Брони' },
  { to: '/admin/menu', label: 'Меню' },
  { to: '/admin/tables', label: 'Столики' },
  { to: '/admin/hours', label: 'Часы' },
  { to: '/admin/users', label: 'Люди' },
];

// Логотип как на лендинге. Лендинг — отдельная страница, поэтому обычная ссылка <a>, а не <Link>.
export function Logo() {
  return (
    <a className="logo" href="/" aria-label="Пенка — на сайт кофейни">
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M7 12h15v6a7.5 7.5 0 0 1-15 0z" />
        <path className="logo-handle" d="M22 13.5h1.6a3 3 0 0 1 0 6H22" />
        <path d="M12 9c-1-1.4 1-2.2 0-3.6M17 9c-1-1.4 1-2.2 0-3.6" />
      </svg>
      Пенка
    </a>
  );
}

export function DemoBar({ demo }) {
  if (!demo) return null;
  return (
    <div className="demo-bar" role="note">
      <b>Демо.</b> Кофейня вымышленная, все брони, заказы и гости — демонстрационные.
    </div>
  );
}

export function AppHeader({ user, area, onLogout, busy }) {
  const tabs = area === 'admin' ? adminTabs : accountTabs;
  const isAdmin = user.role === 'admin';
  return (
    <header className="app-head">
      <div className="wrap app-head__top">
        <Logo />
        <span className="app-head__area">{area === 'admin' ? 'админка' : 'кабинет'}</span>
        <div className="app-head__user">
          {isAdmin && (
            <NavLink className="app-head__switch" to={area === 'admin' ? '/account' : '/admin'}>
              {area === 'admin' ? 'Мой кабинет' : 'Админка'}
            </NavLink>
          )}
          <span className="app-head__name">{user.name}</span>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onLogout} disabled={busy}>
            Выйти
          </button>
        </div>
      </div>
      <nav className="wrap tabs-nav" aria-label="Разделы">
        {tabs.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.end} className="tabs-nav__link">
            {tab.label}
          </NavLink>
        ))}
        <a className="tabs-nav__link tabs-nav__site" href="/">
          На сайт →
        </a>
      </nav>
    </header>
  );
}
