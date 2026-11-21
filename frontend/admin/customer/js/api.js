/**
 * Shared HTTP helpers used by login and register.
 * Not part of a specific WBS breakdown item — this is a utility
 * that supports 1.1.1 and 1.1.2 by handling all API calls to the backend.
 */

export async function postJson(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  return { ok: response.ok, status: response.status, data };
}

export async function putJson(url, payload) {
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  return { ok: response.ok, status: response.status, data };
}

export async function getJson(url) {
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));

  return { ok: response.ok, status: response.status, data };
}
