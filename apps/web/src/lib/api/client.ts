// Read token lazily at call time (not at module load) to avoid circular deps
function getToken(): string | null {
  try {
    const session = localStorage.getItem('qubit_session');
    if (!session) return null;
    return JSON.parse(session).token ?? null;
  } catch {
    return null;
  }
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

const BASE = 'http://localhost:3001/api';

async function handleResponse(res: Response) {
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}

export const api = {
  get: (path: string) =>
    fetch(BASE + path, { headers: authHeaders() }).then(handleResponse),

  post: (path: string, body: unknown) =>
    fetch(BASE + path, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    }).then(handleResponse),

  put: (path: string, body: unknown) =>
    fetch(BASE + path, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(body),
    }).then(handleResponse),
};
