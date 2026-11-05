export class ApiError extends Error {
  constructor(message, status, fieldErrors = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

async function request(url, options) {
  let response;

  try {
    response = await fetch(url, options);
  } catch {
    throw new ApiError('Unable to reach the server. Please check your connection and try again.', 0);
  }

  let data = {};
  try {
    data = await response.json();
  } catch {
    // Empty body (204) or a non-JSON error page.
  }

  if (!response.ok) {
    throw new ApiError(data.message || 'Something went wrong. Please try again.', response.status, data.errors);
  }

  return data;
}

export const getJson = (url) => request(url);

export const sendJson = (url, method, body) =>
  request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

// FormData sets its own multipart Content-Type, so no headers here.
export const sendForm = (url, method, formData) => request(url, { method, body: formData });

export const deleteRequest = (url) => request(url, { method: 'DELETE' });
