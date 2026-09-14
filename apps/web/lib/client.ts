import { UserManager, WebStorageStateStore } from 'oidc-client-ts';
let manager: UserManager | undefined;
export const isDemo =
  process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_LOCAL_DEMO === 'true';
export function auth() {
  if (manager) return manager;
  const authority = process.env.NEXT_PUBLIC_COGNITO_AUTHORITY,
    client_id = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID,
    domain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN;
  if (!authority || !client_id || !domain)
    throw new Error('Deployment configuration is not ready.');
  manager = new UserManager({
    authority,
    client_id,
    redirect_uri: window.location.origin + '/',
    post_logout_redirect_uri: window.location.origin + '/',
    response_type: 'code',
    scope: 'openid email profile',
    automaticSilentRenew: true,
    userStore: new WebStorageStateStore({ store: window.sessionStorage }),
    metadata: {
      issuer: authority,
      authorization_endpoint: `${domain}/oauth2/authorize`,
      token_endpoint: `${domain}/oauth2/token`,
      jwks_uri: `${authority}/.well-known/jwks.json`,
    },
  });
  return manager;
}
export async function token() {
  if (isDemo) return 'local-demo';
  const a = auth();
  if (new URLSearchParams(location.search).has('code')) {
    const u = await a.signinRedirectCallback();
    const opportunity = (u.state as { opportunity?: string } | undefined)?.opportunity;
    history.replaceState(
      {},
      '',
      location.pathname + (opportunity ? `?opportunity=${encodeURIComponent(opportunity)}` : ''),
    );
    return u.access_token;
  }
  const u = await a.getUser();
  return u && !u.expired ? u.access_token : null;
}
export async function signIn() {
  await auth().signinRedirect({
    state: { opportunity: new URLSearchParams(location.search).get('opportunity') },
  });
}
export async function signOut() {
  await auth().removeUser();
  const logout = new URL('/logout', process.env.NEXT_PUBLIC_COGNITO_DOMAIN);
  logout.searchParams.set('client_id', process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!);
  logout.searchParams.set('logout_uri', location.origin + '/');
  location.assign(logout.href);
}
export async function request<T>(
  path: string,
  accessToken: string,
  options?: RequestInit,
): Promise<T> {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) throw new Error('API configuration is not ready.');
  const response = await fetch(base + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${isDemo ? accessToken : (await auth().getUser())?.access_token || accessToken}`,
      ...options?.headers,
    },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Request failed');
  return body;
}
