// Форматирование для интерфейса: рубли, даты, часы, названия статусов и кузовов.

// 12500 → «12 500 ₽»
export function rub(amount) {
  return Math.round(Number(amount) || 0).toLocaleString('ru-RU') + ' ₽';
}

// 2.3 → «2,3 ч»; 0.5 → «30 мин»
export function hoursLabel(hours) {
  const value = Number(hours);
  if (value < 1) return Math.round(value * 60) + ' мин';
  return String(Math.round(value * 10) / 10).replace('.', ',') + ' ч';
}

export const STATUS_LABELS = {
  new: 'Новая',
  confirmed: 'Подтверждена',
  in_work: 'В работе',
  done: 'Выполнена',
  cancelled: 'Отменена',
  no_show: 'Не приехал',
};

// Подписи кнопок смены статуса в админке.
export const STATUS_ACTIONS = {
  confirmed: 'Подтвердить',
  in_work: 'Принять в работу',
  done: 'Выполнено',
  cancelled: 'Отменить',
  no_show: 'Не приехал',
};

export const BODIES = [
  { id: 'sedan', name: 'Седан / хэтчбек' },
  { id: 'cross', name: 'Кроссовер' },
  { id: 'suv', name: 'Внедорожник / минивэн' },
];

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа',
  'сентября', 'октября', 'ноября', 'декабря'];
const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

// Дата и время из базы приходят строкой «2026-11-28 11:00:00» по часам сервиса.
// Разбираем вручную, чтобы браузер в другом часовом поясе не сдвинул время.
export function parseDateTime(text) {
  const [date, time = '00:00:00'] = String(text).split(' ');
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute);
}

// «28 ноября, сб»
export function dateLabel(text) {
  const date = parseDateTime(text);
  return `${date.getDate()} ${MONTHS[date.getMonth()]}, ${WEEKDAYS[date.getDay()]}`;
}

// «11:00»
export function timeLabel(text) {
  return String(text).slice(11, 16);
}

// «28 ноября, сб · 11:00–14:00»
export function bookingWhen(booking) {
  return `${dateLabel(booking.starts_at)} · ${timeLabel(booking.starts_at)}–${timeLabel(booking.ends_at)}`;
}

// «27.11.2026 14:05» — для истории статусов.
export function dateTimeShort(text) {
  const date = parseDateTime(text);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Дата в виде 2026-11-27: сегодня (offset = 0), завтра (1) и т. д.
export function localDate(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return isoDate(date);
}

export function isoDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function offsetDate(iso, days) {
  const [year, month, day] = iso.split('-').map(Number);
  return isoDate(new Date(year, month - 1, day + days));
}

// Машина записи: «Toyota Camry · А001АА 77» или «Kia · кроссовер».
export function carLabel(booking) {
  if (booking.car_model) {
    return `${booking.brand} ${booking.car_model}${booking.car_plate ? ' · ' + booking.car_plate : ''}`;
  }
  return `${booking.brand} · ${String(booking.body_name || '').split(' /')[0].toLowerCase()}`;
}

// Маска телефона, как на лендинге: +7 (999) 999-99-99
export function formatPhone(value) {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('8')) digits = '7' + digits.slice(1);
  if (digits && !digits.startsWith('7')) digits = '7' + digits;
  digits = digits.slice(0, 11);
  let result = digits ? '+7' : '';
  if (digits.length > 1) result += ' (' + digits.slice(1, 4);
  if (digits.length >= 4) result += ')';
  if (digits.length > 4) result += ' ' + digits.slice(4, 7);
  if (digits.length > 7) result += '-' + digits.slice(7, 9);
  if (digits.length > 9) result += '-' + digits.slice(9, 11);
  return result;
}
