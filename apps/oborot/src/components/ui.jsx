// Мелкие общие элементы интерфейса: поле формы, заголовок страницы, сообщения,
// пустой список, метки статуса и демо-данных.
import React from 'react';
import { STATUS_LABELS } from '../format.js';

// Поле формы с подписью и текстом ошибки. as="select" — выпадающий список (options в children).
export function Field({ label, name, error, as = 'input', children, hint, ...props }) {
  const Control = as;
  return (
    <label className={`field${error ? ' field--bad' : ''}`}>
      <span className="field-label">{label}</span>
      <Control
        name={name}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : undefined}
        {...props}
      >
        {children}
      </Control>
      {hint && !error && <small className="field-hint">{hint}</small>}
      {error && (
        <small id={`${name}-error`} className="field-error" role="alert">
          {error}
        </small>
      )}
    </label>
  );
}

// Заголовок страницы в стиле лендинга: «01 / ЗАПИСИ» и крупное название.
export function PageHead({ number, kicker, title, children }) {
  return (
    <div className="page-head">
      <div className="page-num">
        {number} / {kicker}
      </div>
      <h1>{title}</h1>
      {children && <div className="page-actions">{children}</div>}
    </div>
  );
}

// Сообщение об ошибке; если передан retry — с кнопкой «Повторить».
export function Notice({ message, retry, tone = 'error' }) {
  if (!message) return null;
  return (
    <div className={`notice notice--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <p>{message}</p>
      {retry && (
        <button className="btn btn-line btn-sm" type="button" onClick={retry}>
          Повторить
        </button>
      )}
    </div>
  );
}

export function Loading({ text = 'Загружаем…' }) {
  return <p className="loading">{text}</p>;
}

// Пустой список: заголовок, пояснение и кнопка действия (ссылка или обработчик).
export function Empty({ title, detail, action, href, onAction }) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      <p>{detail}</p>
      {href && (
        <a className="btn btn-red" href={href}>
          {action} <span className="arr">→</span>
        </a>
      )}
      {onAction && (
        <button className="btn btn-red" type="button" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  );
}

export function StatusBadge({ status }) {
  return <span className={`status status--${status}`}>{STATUS_LABELS[status] || status}</span>;
}

// Метка «демо» у демонстрационных записей и аккаунтов.
export function DemoBadge({ show }) {
  if (!show) return null;
  return (
    <span className="demo-badge" title="Демонстрационные данные, созданы автоматически">
      демо
    </span>
  );
}
