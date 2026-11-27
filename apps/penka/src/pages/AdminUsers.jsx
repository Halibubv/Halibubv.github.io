// Админка: зарегистрированные гости и сотрудники, смена роли.
import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Loading, Notice, PageHead } from '../components/ui.jsx';
import { day } from '../format.js';

export function AdminUsers({ user, demo }) {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/admin/users')
      .then((data) => setUsers(data.users))
      .catch((e) => setError(e.message));
  }, []);

  async function setRole(target, role) {
    setError('');
    try {
      const data = await api(`/admin/users/${target.id}`, 'PUT', { role });
      setUsers(data.users);
    } catch (e) {
      setError(e.message);
    }
  }

  if (!users) return error ? <Notice type="error">{error}</Notice> : <Loading />;

  return (
    <>
      <PageHead eyebrow="Аккаунты" title="Гости и сотрудники" />
      {demo && <Notice>Демо: роли можно посмотреть, а менять нельзя.</Notice>}
      <Notice type="error" onClose={() => setError('')}>{error}</Notice>
      <div className="card table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Имя</th>
              <th>Email и телефон</th>
              <th>Брони / заказы</th>
              <th>С нами с</th>
              <th>Роль</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td data-label="Имя">{u.name}</td>
                <td data-label="Контакты">
                  {u.email}
                  <br />
                  <span className="muted">{u.phone || '—'}</span>
                </td>
                <td data-label="Брони / заказы">
                  {u.reservations_count} / {u.orders_count}
                </td>
                <td data-label="С нами с">{day(u.created_at, { words: false })}</td>
                <td data-label="Роль">
                  <select value={u.role} disabled={u.id === user.id} onChange={(e) => setRole(u, e.target.value)} aria-label={`Роль: ${u.name}`}>
                    <option value="client">гость</option>
                    <option value="admin">администратор</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
