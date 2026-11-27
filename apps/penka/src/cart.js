// Корзина живёт на лендинге (public/app.js) в localStorage под ключом penka_cart.
// Из кабинета мы только добавляем в неё позиции («Повторить заказ»),
// а потом открываем лендинг с корзиной: /#cart.
const CART_KEY = 'penka_cart';

function readCart() {
  try {
    const list = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

// Добавить позиции заказа в корзину. menuItems — позиции из GET /api/menu.
// Возвращает, что добавили и что пропустили (стоп-лист или пропало из меню).
export function repeatOrder(order, menuItems) {
  const byId = new Map(menuItems.map((item) => [item.id, item]));
  const cart = readCart();
  const added = [];
  const skipped = [];
  for (const line of order.items) {
    const item = byId.get(line.menu_item_id);
    if (!item || !item.is_available) {
      skipped.push(line.name);
      continue;
    }
    const existing = cart.find((x) => x.id === item.id);
    if (existing) existing.qty = Math.min(20, existing.qty + line.qty);
    else cart.push({ id: item.id, qty: line.qty });
    added.push(line.name);
  }
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  } catch {
    // приватный режим браузера: сохранить не получилось
  }
  return { added, skipped };
}
