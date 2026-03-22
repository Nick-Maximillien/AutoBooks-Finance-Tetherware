const DJANGO_REFRESH_URL = process.env.NEXT_PUBLIC_DJANGO_REFRESH_URL || '';

export function getTokensFromLocalStorage() {
  if (typeof window !== 'undefined') {
    return {
      accessToken: localStorage.getItem('accessToken'),
      refreshToken: localStorage.getItem('refreshToken'),
    };
  }
  return { accessToken: null, refreshToken: null };
}

export function setTokensInLocalStorage(access: string | null, refresh: string | null) {
  if (typeof window === 'undefined') return;

  if (access) localStorage.setItem('accessToken', access);
  else localStorage.removeItem('accessToken');

  if (refresh) localStorage.setItem('refreshToken', refresh);
  else localStorage.removeItem('refreshToken');
}

export async function refreshAccessTokenIfNeeded(
  token: string | null,
  refreshToken: string | null
): Promise<string> {
  if (!token || !refreshToken) throw new Error('Missing token(s)');

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp > now + 60) return token;

    const res = await fetch(DJANGO_REFRESH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (!res.ok) throw new Error('Token refresh failed');

    const data = await res.json();
    setTokensInLocalStorage(data.access, refreshToken);
    return data.access;
  } catch (err) {
    console.error('Token refresh error:', err);
    throw err;
  }
}
