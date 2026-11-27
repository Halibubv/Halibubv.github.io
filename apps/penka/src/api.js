// Запросы к PHP-серверу. Все адреса начинаются с /api, сервер отвечает в JSON.
//
// Пример: api('/admin/orders/5/status', 'POST', { status: 'accepted' })
// method — 'GET' (по умолчанию), 'POST', 'PUT' или 'DELETE';
// body — объект, который отправится на сервер (для GET не нужен).
export async function api(path, method = 'GET', body) {
  let response;
  try {
    response = await fetch('/api' + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Нет связи с сервером. Проверьте интернет и повторите попытку.');
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('Сервер вернул неожиданный ответ. Обновите страницу и повторите попытку.');
  }

  if (!response.ok) {
    // 401 — сессия на сервере закончилась: отправляем на вход и потом вернём сюда же.
    if (response.status === 401 && !path.startsWith('/auth/')) {
      window.location.href = '/login?next=' + encodeURIComponent(window.location.pathname);
    }
    // Сервер присылает текст ошибки (error) и ошибки по полям формы (fields).
    const error = new Error(data.error || 'Не удалось выполнить действие.');
    error.status = response.status;
    error.fields = data.fields || {};
    throw error;
  }
  return data;
}
