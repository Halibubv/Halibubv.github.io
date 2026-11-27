// Пенка: живая часть лендинга — корзина и заказ с собой, вход в шапке,
// подстановка имени и телефона вошедшего гостя.
// Меню грузит main.js и передаёт сюда через PenkaApp.setMenu(). Корзина хранится
// в localStorage до отправки заказа, цены и сумму всё равно считает сервер.
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const CART_KEY = "penka_cart";
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const rub = n => n.toLocaleString("ru-RU") + " ₽";
  const MON = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

  let user = null;
  let items = {};      // позиции меню по id: { id, name, price, is_available, ... }
  let menuLoaded = false;
  let cart = readCart(); // [{ id, qty }]

  /* ---------- Запросы к серверу ---------- */
  async function api(path, method = "GET", body) {
    let response;
    try {
      response = await fetch("/api" + path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    } catch {
      throw Object.assign(new Error("Нет связи с сервером. Проверьте интернет и попробуйте ещё раз."), { fields: {} });
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.error || "Не удалось выполнить действие."), { status: response.status, fields: data.fields || {} });
    return data;
  }

  /* ---------- Корзина в localStorage ---------- */
  function readCart() {
    try {
      const list = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
      return Array.isArray(list) ? list.filter(x => Number.isInteger(x.id) && Number.isInteger(x.qty) && x.qty > 0).map(x => ({ id: x.id, qty: Math.min(20, x.qty) })) : [];
    } catch { return []; }
  }
  function saveCart() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { /* приватный режим — корзина живёт до перезагрузки */ }
    renderCount();
    if (!panel.hidden) renderCart();
  }
  function addToCart(id) {
    const line = cart.find(x => x.id === id);
    if (line) line.qty = Math.min(20, line.qty + 1); else cart.push({ id, qty: 1 });
    saveCart();
  }
  function setQty(id, qty) {
    cart = qty > 0 ? cart.map(x => x.id === id ? { id, qty: Math.min(20, qty) } : x) : cart.filter(x => x.id !== id);
    saveCart();
  }
  // Позиции корзины, которые есть в меню. Пропавшие из меню убираем молча.
  const lines = () => cart.filter(x => !menuLoaded || items[x.id]).map(x => ({ ...x, item: items[x.id] }));
  const total = () => lines().reduce((sum, x) => sum + (x.item && x.item.is_available ? x.item.price * x.qty : 0), 0);

  /* ---------- Шапка: вход и счётчик корзины ---------- */
  const cartBtn = $("#cartBtn"), countEl = $("#cartCount"), authLink = $("#authLink");
  function renderCount() {
    const n = lines().reduce((s, x) => s + x.qty, 0);
    countEl.textContent = n;
    countEl.classList.toggle("on", n > 0);
    cartBtn.setAttribute("aria-label", `Корзина, позиций: ${n}`);
  }
  function renderAuth() {
    if (!user) { authLink.textContent = "Войти"; authLink.href = "/login"; return; }
    const admin = user.role === "admin";
    authLink.textContent = admin ? "Админка" : "Кабинет";
    authLink.href = admin ? "/admin" : "/account";
  }

  // Имя и телефон вошедшего гостя — в форму брони и в корзину, если поля ещё пустые.
  function prefill() {
    if (!user) return;
    [["#name", user.name], ["#phone", user.phone], ["#cartName", user.name], ["#cartPhone", user.phone]].forEach(([sel, value]) => {
      const el = $(sel);
      if (el && !el.value && value) el.value = value;
    });
  }

  /* ---------- Панель корзины ---------- */
  document.body.insertAdjacentHTML("beforeend", `
    <div class="cart-overlay" id="cartOverlay" hidden></div>
    <aside class="cart" id="cart" role="dialog" aria-modal="true" aria-labelledby="cartTitle" hidden data-lenis-prevent>
      <div class="cart-head">
        <h2 id="cartTitle">Заказ с собой</h2>
        <button type="button" class="cart-close" id="cartClose" aria-label="Закрыть корзину">×</button>
      </div>
      <div class="cart-body" id="cartBody"></div>
    </aside>
    <div class="cart-toast" id="cartToast" role="status" aria-live="polite"></div>`);
  const panel = $("#cart"), overlay = $("#cartOverlay"), body = $("#cartBody");
  let pickup = [];       // время, к которому можно забрать: ["2026-11-27 14:30", ...]
  let done = null;       // оформленный заказ — показываем «Заказ принят»
  let formError = "";

  function pickupLabel(value) {
    const [date, time] = value.split(" ");
    const d = new Date(date + "T00:00:00");
    const word = isMoscowToday(date) ? "сегодня" : `${d.getDate()} ${MON[d.getMonth()]}`;
    return `${word}, ${time.replace(/^0/, "")}`;
  }
  function isMoscowToday(date) {
    const msk = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Moscow" }));
    return date === `${msk.getFullYear()}-${String(msk.getMonth() + 1).padStart(2, "0")}-${String(msk.getDate()).padStart(2, "0")}`;
  }

  function renderCart() {
    if (done) {
      body.innerHTML = `
        <div class="cart-done">
          <p class="eyebrow">Заказ № ${done.id}</p>
          <p class="cart-done-big">Заказ принят!</p>
          <p>Будет готов к ${pickupLabel(done.ready_at)}. Сумма ${rub(done.total)}, оплата при получении.</p>
          <p class="cart-small">${user ? 'Статус заказа виден в <a href="/account/orders">личном кабинете</a>.' : "Назовите номер заказа на кассе."} Это демо: заказ сохранён в демонстрационной базе и появился на доске заказов в админке.</p>
          <button type="button" class="btn btn-ghost btn-sm" id="cartAgain">Закрыть</button>
        </div>`;
      return;
    }
    const list = lines();
    if (!list.length) {
      body.innerHTML = `<div class="cart-empty"><p class="cart-done-big">Пока пусто</p><p>Добавьте что-нибудь из меню кнопкой «+».</p><a class="btn btn-sm" href="#menu" id="toMenu">К меню</a></div>`;
      return;
    }
    const unavailable = list.filter(x => x.item && !x.item.is_available);
    const times = pickup.map(v => `<option value="${v}">${pickupLabel(v)}</option>`).join("");
    body.innerHTML = `
      <ul class="cart-lines">
        ${list.map(x => {
          const it = x.item;
          const name = it ? esc(it.name) : "Загружаем…";
          const off = it && !it.is_available;
          return `<li class="cart-line${off ? " off" : ""}">
            <div class="cart-line-text"><b>${name}</b><small>${off ? "нет в наличии — уберите из заказа" : it ? `${rub(it.price)}${it.size ? " · " + esc(it.size) : ""}` : ""}</small></div>
            <div class="qty">
              <button type="button" data-qty="${x.id}" data-d="-1" aria-label="Меньше: ${name}">−</button>
              <output>${x.qty}</output>
              <button type="button" data-qty="${x.id}" data-d="1" aria-label="Больше: ${name}"${off ? " disabled" : ""}>+</button>
            </div>
            <span class="cart-line-sum">${it && !off ? rub(it.price * x.qty) : ""}</span>
          </li>`;
        }).join("")}
      </ul>
      <div class="cart-total"><span>Итого</span><b>${rub(total())}</b></div>
      <p class="cart-small">Оплата при получении: картой или наличными на кассе. Онлайн-оплаты нет. Сумму пересчитает сервер по ценам меню.</p>
      <form class="cart-form" id="cartForm" novalidate>
        <label class="cart-field"><span>Когда забрать</span>
          <select id="cartTime" required>${times || '<option value="">Сегодня и завтра заказать уже нельзя</option>'}</select>
        </label>
        <label class="cart-field"><span>Имя</span><input id="cartName" autocomplete="name" required maxlength="100"></label>
        <label class="cart-field"><span>Телефон</span><input id="cartPhone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 (___) ___-__-__" required></label>
        <label class="cart-field"><span>Комментарий (необязательно)</span><textarea id="cartComment" rows="2" maxlength="300" placeholder="Например: без сахара"></textarea></label>
        ${unavailable.length ? `<p class="cart-err">«${esc(unavailable[0].item.name)}» сейчас нет в наличии. Уберите позицию, чтобы оформить заказ.</p>` : ""}
        ${formError ? `<p class="cart-err" role="alert">${esc(formError)}</p>` : ""}
        <button class="btn btn-full" type="submit" id="cartSubmit"${unavailable.length || !times ? " disabled" : ""}>Оформить заказ · ${rub(total())}</button>
      </form>`;
    prefill();
  }

  // Поля формы корзины не перерисовываем, пока гость их заполняет: сохраняем введённое.
  function rerenderKeepingForm() {
    const keep = {};
    ["#cartTime", "#cartName", "#cartPhone", "#cartComment"].forEach(s => { const el = $(s); if (el) keep[s] = el.value; });
    renderCart();
    Object.entries(keep).forEach(([s, v]) => { const el = $(s); if (el && v && (s !== "#cartTime" || pickup.includes(v))) el.value = v; });
  }

  let lastFocus = null;
  function openCart() {
    lastFocus = document.activeElement;
    done = null; formError = "";
    panel.hidden = false; overlay.hidden = false;
    document.documentElement.classList.add("cart-open");
    if (window.__lenis) window.__lenis.stop();
    renderCart();
    $("#cartClose").focus();
    // Время для заказа зависит от «сейчас», поэтому спрашиваем каждый раз при открытии.
    api("/pickup-times").then(d => { pickup = d.times; rerenderKeepingForm(); }).catch(e => { formError = e.message; rerenderKeepingForm(); });
  }
  function closeCart() {
    panel.hidden = true; overlay.hidden = true;
    document.documentElement.classList.remove("cart-open");
    if (window.__lenis) window.__lenis.start();
    if (lastFocus) lastFocus.focus();
  }

  cartBtn.addEventListener("click", openCart);
  overlay.addEventListener("click", closeCart);
  $("#cartClose").addEventListener("click", closeCart);
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !panel.hidden) closeCart(); });

  body.addEventListener("click", e => {
    const q = e.target.closest("[data-qty]");
    if (q) {
      const id = +q.dataset.qty, line = cart.find(x => x.id === id);
      if (line) { setQty(id, line.qty + +q.dataset.d); rerenderKeepingForm(); }
      return;
    }
    if (e.target.closest("#cartAgain")) closeCart();
    if (e.target.closest("#toMenu")) closeCart();
  });

  // Маска телефона +7 (___) ___-__-__, как в форме брони.
  body.addEventListener("input", e => {
    if (e.target.id !== "cartPhone") return;
    const el = e.target;
    let d = el.value.replace(/\D/g, "");
    if (d.startsWith("8")) d = "7" + d.slice(1);
    if (!d.startsWith("7")) d = "7" + d;
    d = d.slice(0, 11);
    const p = d.slice(1);
    let out = "+7";
    if (p.length) out += " (" + p.slice(0, 3);
    if (p.length >= 3) out += ")";
    if (p.length > 3) out += " " + p.slice(3, 6);
    if (p.length > 6) out += "-" + p.slice(6, 8);
    if (p.length > 8) out += "-" + p.slice(8, 10);
    el.value = d.length > 1 ? out : "";
  });

  // Оформление: POST /api/orders. Отправляем только id и количество.
  body.addEventListener("submit", async e => {
    e.preventDefault();
    const name = $("#cartName").value.trim(), phone = $("#cartPhone").value;
    if (name.length < 2) { formError = "Как к вам обращаться? Введите имя."; rerenderKeepingForm(); return; }
    if (phone.replace(/\D/g, "").length !== 11) { formError = "Введите телефон целиком: +7 и ещё 10 цифр."; rerenderKeepingForm(); return; }
    const btn = $("#cartSubmit");
    btn.disabled = true; btn.textContent = "Отправляем…";
    try {
      const data = await api("/orders", "POST", {
        items: lines().map(x => ({ id: x.id, qty: x.qty })),
        ready_at: $("#cartTime").value, name, phone, comment: $("#cartComment").value,
      });
      done = data.order; formError = "";
      cart = []; saveCart();
      renderCart();
    } catch (error) {
      formError = error.message;
      // Позиция могла попасть в стоп-лист, пока гость выбирал: обновляем меню.
      if (error.status === 422 && error.fields.items) await reloadMenu();
      rerenderKeepingForm();
    }
  });

  async function reloadMenu() {
    try { setMenu((await api("/menu")).categories); } catch { /* оставляем как было */ }
  }

  /* ---------- Кнопка «+» в меню ---------- */
  const toast = $("#cartToast");
  let toastTimer;
  $("#menuGrid").addEventListener("click", e => {
    const b = e.target.closest("[data-add]");
    if (!b || b.disabled) return;
    const id = +b.dataset.add;
    addToCart(id);
    b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump");
    cartBtn.classList.remove("bump"); void cartBtn.offsetWidth; cartBtn.classList.add("bump");
    toast.innerHTML = `Добавили «${esc(items[id] ? items[id].name : "позицию")}» <button type="button" id="toastOpen">Корзина</button>`;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
  });
  toast.addEventListener("click", e => { if (e.target.id === "toastOpen") { toast.classList.remove("show"); openCart(); } });

  function setMenu(categories) {
    items = {};
    categories.forEach(c => c.items.forEach(x => { items[x.id] = x; }));
    menuLoaded = true;
    cart = cart.filter(x => items[x.id]); // позиции, которых больше нет в меню
    saveCart();
    // Из кабинета «Повторить заказ» ведёт на /#cart — сразу открываем корзину.
    if (location.hash === "#cart") { history.replaceState(null, "", location.pathname); openCart(); }
  }

  /* ---------- Кто вошёл ---------- */
  api("/session").then(d => { user = d.user; renderAuth(); prefill(); }).catch(() => {});

  renderCount();
  window.PenkaApp = { setMenu, prefill };
})();
