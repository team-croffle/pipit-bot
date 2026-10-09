/**
 * The message the server meant for the operator.
 *
 * Routes answer a failure with `{ error }` (or `{ ok: false, message }`), so showing the raw body would put
 * JSON punctuation in front of a person. The text is used as-is when it is not JSON,
 * which is what a proxy or a crash returns.
 */
async function failureMessage(response: Response): Promise<string> {
  const detail = await response.text();
  try {
    const body = JSON.parse(detail) as { error?: unknown; ok?: unknown; message?: unknown };
    if (typeof body.error === 'string' && body.error) {
      return body.error;
    }
    // The playback actions answer a refusal ("already paused") as `{ ok: false, message }`.
    if (body.ok === false && typeof body.message === 'string' && body.message) {
      return body.message;
    }
  } catch {
    // Not JSON — fall through to the raw text.
  }

  return detail || `${response.status} ${response.statusText}`;
}

export async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: 'include' });
  if (response.status === 401) {
    window.location.assign('/api/auth/login');
    throw new Error('Redirecting to login…');
  }
  if (!response.ok) {
    throw new Error(await failureMessage(response));
  }

  return response.json() as Promise<T>;
}

export async function putJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (response.status === 401) {
    window.location.assign('/api/auth/login');
    throw new Error('Redirecting to login…');
  }
  if (!response.ok) {
    throw new Error(await failureMessage(response));
  }

  return response.json() as Promise<T>;
}

export async function postJson<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 401) {
    window.location.assign('/api/auth/login');
    throw new Error('Redirecting to login…');
  }
  if (!response.ok) {
    throw new Error(await failureMessage(response));
  }

  return response.json() as Promise<T>;
}

export function logout(): void {
  window.location.assign('/api/auth/logout');
}
