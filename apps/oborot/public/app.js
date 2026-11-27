// Связь лендинга с сервером: запросы к API, кнопка входа в шапке и выбор машины из гаража.
// Подключается в index.html перед основным скриптом лендинга и даёт ему объект window.Oborot.
// Вёрстку лендинга этот файл почти не трогает: свои стили у него в app.css.
(() => {
  // Запрос к API. Сервер отвечает JSON; при ошибке бросаем Error с текстом от сервера.
  // Запросы на изменение сервер принимает только с Content-Type: application/json.
  async function api(path, method = 'GET', body) {
    let response;
    try {
      response = await fetch('/api' + path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        credentials: 'same-origin',
      });
    } catch {
      throw new Error('Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.');
    }
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error('Сервер сейчас недоступен. Попробуйте чуть позже.');
    }
    if (!response.ok) {
      const error = new Error(data.error || 'Не удалось выполнить действие.');
      error.status = response.status;
      error.fields = data.fields || {};
      throw error;
    }
    return data;
  }

  // Текст ошибки для формы: сначала ошибки по полям, иначе общее сообщение.
  function errorText(error) {
    const fields = Object.values(error.fields || {});
    return fields.length ? fields.join(' ') : error.message;
  }

  // Кто вошёл. Если сервер не ответил — считаем гостем.
  const session = api('/session').catch(() => ({ user: null, demo: false }));
  let currentUser = null;

  // Кнопка в шапке: «Войти» у гостя, «Кабинет» у клиента, «Админка» у администратора.
  session.then(({ user }) => {
    currentUser = user;
    const link = document.getElementById('navAuth');
    if (!link || !user) return;
    const admin = user.role === 'admin';
    link.textContent = admin ? 'Админка' : 'Кабинет';
    link.href = admin ? '/admin' : '/account';
  });

  async function loadCars(user) {
    if (!user) return [];
    try {
      return (await api('/account/cars')).cars;
    } catch {
      return [];
    }
  }

  const escapeHtml = (text) =>
    String(text).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

  // Выбор машины из гаража в форме записи. Рисуется перед подписью «Контакты».
  // onSelect(car) получает машину или null («без машины»). Возвращает { reset }.
  function renderGarage(beforeEl, cars, onSelect) {
    const block = document.createElement('div');
    block.className = 'garage-pick';
    block.innerHTML =
      '<span class="lbl">Машина из гаража</span><div class="garage-cars">' +
      '<button type="button" class="garage-car" data-car="" aria-pressed="true"><b>Другая машина</b><small>марка и кузов из калькулятора</small></button>' +
      cars
        .map(
          (car) =>
            `<button type="button" class="garage-car" data-car="${car.id}" aria-pressed="false"><b>${escapeHtml(car.brand)} ${escapeHtml(car.model)}</b><small>${escapeHtml(car.body_name)}${car.plate ? ' · ' + escapeHtml(car.plate) : ''}</small></button>`,
        )
        .join('') +
      '</div>';
    beforeEl.parentNode.insertBefore(block, beforeEl);
    const buttons = [...block.querySelectorAll('.garage-car')];
    const mark = (id) => buttons.forEach((b) => b.setAttribute('aria-pressed', b.dataset.car === String(id ?? '')));
    block.addEventListener('click', (event) => {
      const button = event.target.closest('.garage-car');
      if (!button) return;
      const car = cars.find((c) => String(c.id) === button.dataset.car) || null;
      mark(car ? car.id : '');
      onSelect(car);
    });
    return { reset: () => mark('') };
  }

  // После записи: вошедшему клиенту — ссылка на кабинет, гостю — предложение войти.
  function afterBooking(textEl) {
    const link = document.createElement('a');
    link.className = 'done-link';
    if (currentUser) {
      link.href = currentUser.role === 'admin' ? '/admin/bookings' : '/account';
      link.textContent = currentUser.role === 'admin' ? 'Открыть в админке →' : 'Запись в личном кабинете →';
    } else {
      link.href = '/register';
      link.textContent = 'Создайте кабинет, чтобы видеть свои записи →';
    }
    textEl.append(document.createElement('br'), link);
  }

  window.Oborot = { api, errorText, session, loadCars, renderGarage, afterBooking };
})();
