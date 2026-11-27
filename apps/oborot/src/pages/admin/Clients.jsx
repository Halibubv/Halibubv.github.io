// Админка: клиенты — имя, email, телефон, число записей, последняя запись.
// Здесь же можно дать сотруднику роль администратора (на демо сервер это запрещает).
import React, { useEffect, useState } from 'react';
import { api, errorText } from '../../api.js';
import { DemoBadge, Loading, Notice, PageHead } from '../../components/ui.jsx';
import { dateLabel } from '../../format.js';

export function Clients({ user, demo }) {
  const [clients, setClients] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function load() {
    setError('');
    api('/admin/clients')
      .then((data) => setClients(data.clients))
      .catch((loadError) => setError(loadError.message));
  }
  useEffect(load, []);

  async function setRole(client, role) {
    const text = role === 'admin' ? `Дать ${client.name} доступ к админке?` : `Убрать у ${client.name} доступ к админке?`;
    if (!window.confirm(text)) return;
    setMessage('');
    try {
      const data = await api(`/admin/clients/${client.id}/role`, 'PUT', { role });
      setClients(data.clients);
    } catch (roleError) {
      setMessage(errorText(roleError));
    }
  }

  return (
    <main className="wrap page">
      <PageHead number="05" kicker="Админка" title="Клиенты" />
      <p className="muted small">
        Здесь зарегистрированные пользователи. Гости, записавшиеся без регистрации, есть только в записях.
        {demo ? ' Демо-режим: роли менять нельзя.' : ''}
      </p>
      <Notice message={error} retry={load} />
      <Notice message={message} />
      {!clients && !error && <Loading />}
      {clients && (
        <div className="table table--clients" role="table" aria-label="Клиенты">
          <div className="table-row table-head" role="row">
            <span role="columnheader">Имя</span>
            <span role="columnheader">Контакты</span>
            <span role="columnheader">Записей</span>
            <span role="columnheader">Последняя запись</span>
            <span role="columnheader">Роль</span>
          </div>
          {clients.map((client) => (
            <div key={client.id} className="table-row" role="row">
              <span role="cell">
                <b>
                  {client.name} <DemoBadge show={client.is_demo} />
                </b>
              </span>
              <span role="cell">
                <b className="mono small-text">{client.email}</b>
                <small className="mono">{client.phone || '—'}</small>
              </span>
              <span className="mono" role="cell">
                {client.bookings_count}
              </span>
              <span role="cell">{client.last_booking ? dateLabel(client.last_booking) : '—'}</span>
              <span role="cell" className="table-actions">
                <span className={`role role--${client.role}`}>{client.role === 'admin' ? 'Админ' : 'Клиент'}</span>
                {client.id !== user.id && (
                  <button
                    className="btn btn-text btn-sm"
                    type="button"
                    onClick={() => setRole(client, client.role === 'admin' ? 'client' : 'admin')}
                  >
                    {client.role === 'admin' ? 'Сделать клиентом' : 'Сделать админом'}
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
