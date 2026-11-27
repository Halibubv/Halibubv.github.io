// Корневой компонент: узнаёт, кто вошёл, и по адресу выбирает экран.
// Защита маршрутов: гость в кабинете или админке попадает на вход,
// клиент в админке видит «Нет доступа». Настоящая проверка — на сервере
// (401 гостю и 403 клиенту), здесь мы только не показываем лишнего.
import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api } from './api.js';
import { DemoBar, Footer, Header, Logo } from './components/Layout.jsx';
import { AuthPage } from './pages/AuthPage.jsx';
import { MyBookings } from './pages/account/MyBookings.jsx';
import { Garage } from './pages/account/Garage.jsx';
import { Profile } from './pages/account/Profile.jsx';
import { Summary } from './pages/admin/Summary.jsx';
import { AdminBookings } from './pages/admin/Bookings.jsx';
import { BookingCard } from './pages/admin/BookingCard.jsx';
import { Schedule } from './pages/admin/Schedule.jsx';
import { Services } from './pages/admin/Services.jsx';
import { Clients } from './pages/admin/Clients.jsx';
import { Settings } from './pages/admin/Settings.jsx';

function Message({ title, text, children }) {
  return (
    <main className="wrap message-page">
      <h1>{title}</h1>
      <p>{text}</p>
      {children}
    </main>
  );
}

// Куда отправить после входа: администратора — в админку, клиента — в кабинет.
export function homeFor(user) {
  return user.role === 'admin' ? '/admin' : '/account';
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  // undefined — ещё не знаем, null — гость, объект — вошедший пользователь.
  const [user, setUser] = useState(undefined);
  const [demo, setDemo] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const [logoutBusy, setLogoutBusy] = useState(false);

  // При открытии страницы спрашиваем сервер, кто вошёл, и включён ли демо-режим.
  useEffect(() => {
    api('/session')
      .then((data) => {
        setUser(data.user);
        setDemo(data.demo);
      })
      .catch((error) => {
        setSessionError(error.message);
        setUser(null);
      });
  }, []);

  // Перешли на другую страницу — прокручиваем её в начало.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  async function logout() {
    setLogoutBusy(true);
    try {
      await api('/auth/logout', 'POST');
      setUser(null);
      navigate('/login');
    } catch (error) {
      setSessionError(error.message);
    } finally {
      setLogoutBusy(false);
    }
  }

  if (user === undefined) {
    return (
      <div className="loading-screen">
        <Logo />
        <p>Загружаем…</p>
      </div>
    );
  }

  const path = location.pathname;
  const area = path.startsWith('/admin') ? 'admin' : path.startsWith('/account') ? 'account' : null;

  // --- Вход и регистрация ---
  if (!area) {
    if (user && (path === '/login' || path === '/register')) {
      return <Navigate to={location.state?.from || homeFor(user)} replace />;
    }
    return (
      <>
        <DemoBar demo={demo} />
        {sessionError && <div className="global-error">{sessionError}</div>}
        <Routes>
          <Route path="/login" element={<AuthPage mode="login" demo={demo} onAuth={setUser} />} />
          <Route path="/register" element={<AuthPage mode="register" demo={demo} onAuth={setUser} />} />
          <Route path="/ui/*" element={<Navigate to="/login" replace />} />
          <Route
            path="*"
            element={
              <Message title="Страница не найдена" text="Такой страницы нет.">
                <a className="btn btn-red" href="/">
                  На главную
                </a>
              </Message>
            }
          />
        </Routes>
      </>
    );
  }

  // --- Кабинет и админка: только для вошедших ---
  if (!user) {
    return <Navigate to="/login" replace state={{ from: path }} />;
  }

  let content;
  if (area === 'admin' && user.role !== 'admin') {
    content = (
      <Message title="Нет доступа" text="Админка доступна только сотрудникам сервиса.">
        <a className="btn btn-red" href="/account">
          В личный кабинет
        </a>
      </Message>
    );
  } else if (area === 'admin') {
    content = (
      <Routes>
        <Route path="/admin" element={<Summary />} />
        <Route path="/admin/bookings" element={<AdminBookings />} />
        <Route path="/admin/bookings/:id" element={<BookingCard />} />
        <Route path="/admin/schedule" element={<Schedule />} />
        <Route path="/admin/services" element={<Services demo={demo} />} />
        <Route path="/admin/clients" element={<Clients user={user} demo={demo} />} />
        <Route path="/admin/settings" element={<Settings demo={demo} />} />
        <Route path="*" element={<Message title="Страница не найдена" text="В админке нет такого раздела." />} />
      </Routes>
    );
  } else {
    content = (
      <Routes>
        <Route path="/account" element={<MyBookings />} />
        <Route path="/account/garage" element={<Garage />} />
        <Route path="/account/profile" element={<Profile user={user} demo={demo} onUpdate={setUser} />} />
        <Route path="*" element={<Message title="Страница не найдена" text="В кабинете нет такого раздела." />} />
      </Routes>
    );
  }

  return (
    <>
      <DemoBar demo={demo} />
      <Header user={user} area={area} onLogout={logout} busy={logoutBusy} />
      {sessionError && <div className="global-error">{sessionError}</div>}
      <div className="app-main">{content}</div>
      <Footer />
    </>
  );
}
