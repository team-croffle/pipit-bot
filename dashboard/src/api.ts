export async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: 'include' });
  if (response.status === 401) {
    window.location.assign('/api/auth/login');
    throw new Error('Redirecting to login…');
  }
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `${response.status} ${response.statusText}`);
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
    const detail = await response.text();
    throw new Error(detail || `${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export function logout(): void {
  window.location.assign('/api/auth/logout');
}
