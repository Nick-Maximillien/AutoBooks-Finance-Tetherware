import { getTokensFromLocalStorage, refreshAccessTokenIfNeeded } from 'utils/tokenUtils';

export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const { accessToken, refreshToken } = getTokensFromLocalStorage();

  if (!accessToken) throw new Error('Missing access token');

  const newAccessToken = await refreshAccessTokenIfNeeded(accessToken, refreshToken);

  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${newAccessToken}`,
      'Content-Type': 'application/json',
    },
  });
}
