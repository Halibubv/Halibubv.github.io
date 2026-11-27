// Корневой компонент: узнаёт, кто вошёл, и по адресу выбирает экран.
// Гость — только вход и регистрация; клиент — кабинет; администратор — ещё и админка.
// Это удобство интерфейса, а настоящая защита — на сервере (require_user / require_admin).
import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api } from './api.js';
import { AppHeader, DemoBar, Logo } from './components/Layout.jsx';
import { Loading } from './components/ui.jsx';
import { AuthPage } from './pages/AuthPage.jsx';
import { AccountReservations } from './pages/AccountReservations.jsx';
import { AccountOrders } from './pages/AccountOrders.jsx';
import { AccountProfile } from './pages/AccountProfile.jsx';
import { AdminToday } from './pages/AdminToday.jsx';
import { AdminOrders } from './pages/AdminOrders.jsx';
import { AdminReservations } from './pages/AdminReservations.jsx';
import { AdminMenu } from './pages/AdminMenu.jsx';
import { AdminTables } from './pages/AdminTables.jsx';
import { AdminHours } from './pages/AdminHours.jsx';
import { AdminUsers } from './pages/AdminUsers.jsx';

function Message({ title, text, link = '/', linkText = 'На сайт кофейни' }) {
  return (
    <div className="message-page">
      <Logo />
      <h1>{title}</h1>
      <p>{text}</p>
      <a className="btn" href={link}>
        {linkText}
      </a>
    </div>
  );
}

// Куда вести после входа: туда, откуда пришли (?next=), иначе в кабинет или админку.
function homeFor(user, next) {
  if (next && next.startsWith('/') && !next.startsWith('//') && (user.role === 'admin' || !next.startsWith('/admin'))) {
    return next;
  }
  return user.role === 'admin' ? '/admin' : '/account';
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  // undefined — ещё не знаем, null — гость, объект — вошедший пользователь.
  const [user, setUser] = useState(undefined);
  const [demo, setDemo] = useState(false);
  const [demoLogins, setDemoLogins] = useState([]);
  const [sessionError, setSessionError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/session')
      .then((data) => {
        setUser(data.user);
        setDemo(data.demo);
        setDemoLogins(data.demo_logins || []);
      })
      .catch((error) => {
        setSessionError(error.message);
        setUser(null);
      });
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  async function logout() {
    setBusy(true);
    try {
      await api('/auth/logout', 'POST');
      setUser(null);
      navigate('/login');
    } catch (error) {
      setSessionError(error.message);
    } finally {
      setBusy(false);
    }
  }

  if (user === undefined) {
    return <Loading text="Загружаем Пенку…" />;
  }

  const path = location.pathname;
  const next = new URLSearchParams(location.search).get('next');

  // Гость: на /register — регистрация, на любом другом адресе — вход.
  // Адрес, куда он шёл, запоминаем в ?next=, чтобы вернуть туда после входа.
  if (!user) {
    const authNext = path === '/login' || path === '/register' ? next : path;
    return (
      <>
        <DemoBar demo={demo} />
        <AuthPage
          mode={path === '/register' ? 'register' : 'login'}
          demoLogins={demoLogins}
          sessionError={sessionError}
          next={authNext}
          onAuth={(nextUser) => {
            setUser(nextUser);
            navigate(homeFor(nextUser, authNext), { replace: true });
          }}
        />
      </>
    );
  }

  const area = path.startsWith('/admin') ? 'admin' : 'account';
  if (area === 'admin' && user.role !== 'admin') {
    return (
      <Message
        title="Только для администратора"
        text="Админка кофейни открыта только сотрудникам. Ваши брони и заказы — в личном кабинете."
        link="/account"
        linkText="В личный кабинет"
      />
    );
  }

  return (
    <div className={`app app--${area}`}>
      <DemoBar demo={demo} />
      <AppHeader user={user} area={area} onLogout={logout} busy={busy} />
      <main className="wrap app-main">
        <Routes>
          <Route path="/login" element={<Navigate to={homeFor(user, next)} replace />} />
          <Route path="/register" element={<Navigate to={homeFor(user, next)} replace />} />
          <Route path="/account" element={<AccountReservations />} />
          <Route path="/account/orders" element={<AccountOrders />} />
          <Route path="/account/profile" element={<AccountProfile user={user} onUpdate={setUser} demo={demo} />} />
          <Route path="/admin" element={<AdminToday demo={demo} />} />
          <Route path="/admin/orders" element={<AdminOrders />} />
          <Route path="/admin/reservations" element={<AdminReservations />} />
          <Route path="/admin/menu" element={<AdminMenu demo={demo} />} />
          <Route path="/admin/tables" element={<AdminTables demo={demo} />} />
          <Route path="/admin/hours" element={<AdminHours demo={demo} />} />
          <Route path="/admin/users" element={<AdminUsers user={user} demo={demo} />} />
          <Route path="*" element={<p className="empty__title">Такой страницы нет.</p>} />
        </Routes>
      </main>
    </div>
  );
}
