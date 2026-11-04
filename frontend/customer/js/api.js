// Sends JSON to the backend and always resolves with { ok, status, data },
// so callers can read the server's error messages without try/catch around parsing.
export async function postJson(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    // The server replied with something that isn't JSON; callers fall back to a generic message.
  }

  return { ok: response.ok, status: response.status, data };
}
