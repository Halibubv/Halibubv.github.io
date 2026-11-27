// Админка: меню по разделам. Стоп-лист — в один клик. Добавить, изменить, скрыть, удалить.
// Удалить позицию, которую уже заказывали, нельзя (сервер ответит 409) — только скрыть.
import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Field, Loading, Notice, PageHead, Switch } from '../components/ui.jsx';
import { rub } from '../format.js';

const ICON_NAMES = { cup: 'чашка', glass: 'стакан', tea: 'чай', plate: 'тарелка', egg: 'яйцо', croissant: 'круассан', bun: 'булочка', bread: 'хлеб' };
const blank = { name: '', description: '', price: '', size: '', tags: [], icon: 'cup', sort: 0, is_hidden: false };

function ItemForm({ item, categories, tags, icons, onSaved, onCancel }) {
  const [values, setValues] = useState({ ...blank, ...item, price: String(item.price ?? ''), description: item.description || '', size: item.size || '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (name, value) => setValues((v) => ({ ...v, [name]: value }));

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setErrors({});
    const body = { ...values, price: Number(values.price), sort: Number(values.sort), category_id: Number(values.category_id) };
    try {
      const data = item.id ? await api(`/admin/menu/${item.id}`, 'PUT', body) : await api('/admin/menu', 'POST', body);
      onSaved(data.item, item.id ? 'Сохранили.' : 'Позиция добавлена.');
    } catch (e) {
      setError(e.message);
      setErrors(e.fields || {});
      setBusy(false);
    }
  }

  return (
    <form className="card form item-form" onSubmit={submit} noValidate>
      <h3 className="card__title">{item.id ? `Изменить: ${item.name}` : 'Новая позиция'}</h3>
      <Notice type="error">{error}</Notice>
      <div className="form-grid">
        <Field label="Название" value={values.name} onChange={(e) => set('name', e.target.value)} error={errors.name} />
        <Field as="select" label="Раздел" value={values.category_id} onChange={(e) => set('category_id', e.target.value)} error={errors.category_id}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Field>
        <Field label="Цена, ₽" type="number" min="1" value={values.price} onChange={(e) => set('price', e.target.value)} error={errors.price} />
        <Field label="Объём / вес" placeholder="250 мл" value={values.size} onChange={(e) => set('size', e.target.value)} error={errors.size} />
        <Field as="select" label="Значок" value={values.icon} onChange={(e) => set('icon', e.target.value)}>
          {icons.map((icon) => (
            <option key={icon} value={icon}>
              {ICON_NAMES[icon] || icon}
            </option>
          ))}
        </Field>
        <Field label="Порядок" type="number" min="0" value={values.sort} onChange={(e) => set('sort', e.target.value)} error={errors.sort} />
      </div>
      <Field as="textarea" rows="2" label="Описание" value={values.description} onChange={(e) => set('description', e.target.value)} error={errors.description} />
      <fieldset className="checks">
        <legend>Метки</legend>
        {tags.map((tag) => (
          <label key={tag}>
            <input
              type="checkbox"
              checked={values.tags.includes(tag)}
              onChange={(e) => set('tags', e.target.checked ? [...values.tags, tag] : values.tags.filter((t) => t !== tag))}
            />
            {tag}
          </label>
        ))}
        <label>
          <input type="checkbox" checked={values.is_hidden} onChange={(e) => set('is_hidden', e.target.checked)} />
          скрыть с сайта
        </label>
      </fieldset>
      <div className="form-actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Отмена
        </button>
        <button type="submit" className="btn" disabled={busy}>
          {busy ? 'Сохраняем…' : 'Сохранить'}
        </button>
      </div>
    </form>
  );
}

export function AdminMenu({ demo }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editing, setEditing] = useState(null); // позиция в форме или { category_id } для новой

  function load() {
    return api('/admin/menu')
      .then(setData)
      .catch((e) => setError(e.message));
  }
  useEffect(() => {
    load();
  }, []);

  async function toggle(item, available) {
    setError('');
    try {
      await api(`/admin/menu/${item.id}/availability`, 'POST', { is_available: available });
      setSuccess(available ? `«${item.name}» снова в наличии.` : `«${item.name}» в стоп-листе: на сайте видна, но заказать нельзя.`);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function quickHide(item) {
    setError('');
    try {
      await api(`/admin/menu/${item.id}`, 'PUT', { ...item, is_hidden: !item.is_hidden });
      setSuccess(item.is_hidden ? `«${item.name}» снова на сайте.` : `«${item.name}» скрыта с сайта.`);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function remove(item) {
    if (!window.confirm(`Удалить «${item.name}» из меню насовсем?`)) return;
    setError('');
    try {
      await api(`/admin/menu/${item.id}`, 'DELETE');
      setSuccess(`«${item.name}» удалена.`);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  if (!data) return error ? <Notice type="error">{error}</Notice> : <Loading />;
  const categories = data.categories;

  return (
    <>
      <PageHead eyebrow="Меню" title="Меню и стоп-лист" />
      {demo && (
        <Notice>
          Демо: стоп-лист переключается по-настоящему и сразу виден на сайте. Цены и состав меню здесь менять нельзя — сервер
          ответит отказом.
        </Notice>
      )}
      <Notice type="error" onClose={() => setError('')}>{error}</Notice>
      <Notice type="success" onClose={() => setSuccess('')}>{success}</Notice>

      {categories.map((category) => (
        <section key={category.id} className="menu-section">
          <div className="menu-section__head">
            <h2 className="section-title">{category.name}</h2>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing({ category_id: category.id, sort: category.items.length + 1 })}>
              + Добавить
            </button>
          </div>
          {editing && !editing.id && editing.category_id === category.id && (
            <ItemForm
              item={editing}
              categories={categories}
              tags={data.tags}
              icons={data.icons}
              onCancel={() => setEditing(null)}
              onSaved={(_, text) => {
                setEditing(null);
                setSuccess(text);
                load();
              }}
            />
          )}
          <div className="menu-rows">
            {category.items.map((item) =>
              editing && editing.id === item.id ? (
                <ItemForm
                  key={item.id}
                  item={editing}
                  categories={categories}
                  tags={data.tags}
                  icons={data.icons}
                  onCancel={() => setEditing(null)}
                  onSaved={(_, text) => {
                    setEditing(null);
                    setSuccess(text);
                    load();
                  }}
                />
              ) : (
                <article key={item.id} className={`menu-row${item.is_available ? '' : ' menu-row--off'}${item.is_hidden ? ' menu-row--hidden' : ''}`}>
                  <div className="menu-row__main">
                    <p className="menu-row__name">
                      {item.name}
                      {item.tags.map((t) => (
                        <span key={t} className={`tag${t === 'хит' ? ' tag--hot' : ''}`}>
                          {t}
                        </span>
                      ))}
                      {item.is_hidden && <span className="tag tag--hidden">скрыта</span>}
                    </p>
                    <p className="muted small">
                      {item.description}
                      {item.size ? ` · ${item.size}` : ''}
                    </p>
                  </div>
                  <b className="menu-row__price">{rub(item.price)}</b>
                  <Switch checked={item.is_available} onChange={(v) => toggle(item, v)} label={item.is_available ? 'в наличии' : 'стоп-лист'} />
                  <div className="menu-row__actions">
                    <button type="button" className="link-btn" onClick={() => setEditing(item)}>
                      Изменить
                    </button>
                    <button type="button" className="link-btn" onClick={() => quickHide(item)}>
                      {item.is_hidden ? 'Показать' : 'Скрыть'}
                    </button>
                    <button type="button" className="link-btn link-btn--danger" onClick={() => remove(item)}>
                      Удалить
                    </button>
                  </div>
                </article>
              ),
            )}
          </div>
        </section>
      ))}
    </>
  );
}
