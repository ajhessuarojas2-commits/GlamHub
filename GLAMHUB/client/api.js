let csrfToken = '';

export function setCsrfToken(token) {
  csrfToken = token || '';
}

export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const isForm = options.body instanceof FormData;
  if (options.body && !isForm) headers.set('Content-Type', 'application/json');
  if (options.method && options.method !== 'GET') headers.set('X-CSRF-Token', csrfToken);
  const response = await fetch(`/api${path}`, {
    ...options,
    headers,
    body: options.body && !isForm ? JSON.stringify(options.body) : options.body,
    credentials: 'same-origin',
  });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || 'No se pudo completar la solicitud.');
  return data;
}

export function money(value) {
  return `$${Number(value || 0).toLocaleString('es-CO')} COP`;
}

export function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function serviceIcon(name) {
  if (/corte|peinado|alisado|balayage|tinte|lavado|secado|capilar/i.test(name)) return '💇';
  if (/manicure|uñas|unas/i.test(name)) return '💅';
  if (/pedicure/i.test(name)) return '🦶';
  if (/maquillaje/i.test(name)) return '💄';
  if (/pestañas|pestanas|cejas/i.test(name)) return '👁️';
  if (/facial|spa/i.test(name)) return '✨';
  return '🌸';
}
