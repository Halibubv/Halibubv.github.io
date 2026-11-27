// Мелкие общие части интерфейса: поле формы, сообщения, метка статуса, загрузка.
import React from 'react';

// Поле формы с подписью и текстом ошибки под ним.
export function Field({ label, error, hint, as = 'input', children, ...props }) {
  const Tag = as;
  return (
    <label className={`field${error ? ' field--error' : ''}`}>
      <span className="field__label">{label}</span>
      {as === 'select' ? <select {...props}>{children}</select> : <Tag {...props} />}
      {error ? <small className="field__error">{error}</small> : hint && <small className="field__hint">{hint}</small>}
    </label>
  );
}

// Сообщение над формой или списком. type: 'error' | 'success' | 'info'.
export function Notice({ type = 'info', children, onClose }) {
  if (!children) return null;
  return (
    <div className={`notice notice--${type}`} role={type === 'error' ? 'alert' : 'status'}>
      <div>{children}</div>
      {onClose && (
        <button type="button" className="notice__close" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
      )}
    </div>
  );
}

export function StatusBadge({ status, labels }) {
  return <span className={`badge badge--${status}`}>{labels[status] || status}</span>;
}

export function Loading({ text = 'Загружаем…' }) {
  return (
    <div className="loading" role="status">
      <span className="loading__cup" aria-hidden="true" />
      {text}
    </div>
  );
}

export function Empty({ title, children }) {
  return (
    <div className="empty">
      <p className="empty__title">{title}</p>
      {children}
    </div>
  );
}

// Заголовок страницы: надзаголовок, заголовок и что-нибудь справа (кнопки).
export function PageHead({ eyebrow, title, children }) {
  return (
    <div className="page-head">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
      </div>
      {children && <div className="page-head__actions">{children}</div>}
    </div>
  );
}

// Переключатель «да/нет» (стоп-лист, активный столик).
export function Switch({ checked, onChange, label, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`switch${checked ? ' switch--on' : ''}`}
      onClick={() => onChange(!checked)}
      disabled={disabled}
    >
      <span className="switch__knob" aria-hidden="true" />
      <span className="switch__label">{label}</span>
    </button>
  );
}
