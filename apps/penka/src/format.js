// Даты, деньги и названия статусов по-русски.

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
export const WEEKDAYS_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

// Сервер присылает время строкой «2026-11-27 14:30» (московское). Разбираем её
// сами, без часового пояса браузера: гость может быть в другом городе.
function parts(value) {
  const [date, time = ''] = value.split(' ');
  const [y, m, d] = date.split('-').map(Number);
  return { y, m, d, time: time.slice(0, 5) };
}

// Сегодняшняя дата по Москве: «2026-11-27».
export function moscowToday(offsetDays = 0) {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
  now.setDate(now.getDate() + offsetDays);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// «9:30» вместо «09:30».
export function time(value) {
  return parts(value).time.replace(/^0/, '');
}

// «27 ноября», для сегодняшнего и завтрашнего дня — «сегодня» и «завтра».
export function day(value, { words = true } = {}) {
  const date = value.slice(0, 10);
  if (words && date === moscowToday()) return 'сегодня';
  if (words && date === moscowToday(1)) return 'завтра';
  if (words && date === moscowToday(-1)) return 'вчера';
  const { d, m } = parts(value);
  return `${d} ${MONTHS[m - 1]}`;
}

// «пятница, 27 ноября»
export function longDay(date) {
  const { y, m, d } = parts(date);
  return `${WEEKDAYS[new Date(y, m - 1, d).getDay()]}, ${d} ${MONTHS[m - 1]}`;
}

export function dateTime(value) {
  return `${day(value)}, ${time(value)}`;
}

export function rub(value) {
  return Number(value).toLocaleString('ru-RU') + ' ₽';
}

// Склонение: plural(3, 'гость', 'гостя', 'гостей') → «гостя».
export function plural(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export const RESERVATION_STATUS = {
  new: 'Новая',
  confirmed: 'Подтверждена',
  seated: 'Гости пришли',
  closed: 'Завершена',
  cancelled: 'Отменена',
  no_show: 'Не пришли',
};

export const ORDER_STATUS = {
  new: 'Новый',
  accepted: 'Принят',
  ready: 'Готов',
  issued: 'Выдан',
  cancelled: 'Отменён',
};

export const ZONES = { window: 'у окна', sofa: 'диван', big: 'большой стол' };
