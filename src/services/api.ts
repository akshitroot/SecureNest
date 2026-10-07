export function getAuthToken(): string | null {
  return localStorage.getItem('securenest_token');
}

export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem('securenest_token', token);
    localStorage.removeItem('securenest_logged_out');
  } else {
    localStorage.removeItem('securenest_token');
  }
}

export function setLoggedOutFlag(loggedOut: boolean) {
  if (loggedOut) {
    localStorage.setItem('securenest_logged_out', 'true');
    localStorage.removeItem('securenest_token');
  } else {
    localStorage.removeItem('securenest_logged_out');
  }
}

export function isLoggedOut(): boolean {
  return localStorage.getItem('securenest_logged_out') === 'true';
}

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});
  
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: 'include'
  });
}
