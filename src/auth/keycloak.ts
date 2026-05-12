import Keycloak from 'keycloak-js';
import { setAuth, clearAuth } from '../store/slices/authSlice';
import { store } from '../store';

const keycloakConfig = {
  url: import.meta.env.VITE_KEYCLOAK_URL,
  realm: import.meta.env.VITE_KEYCLOAK_REALM,
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID,
};

const keycloak = new Keycloak(keycloakConfig);

export const initKeycloak = () => {
  const initPromise = keycloak.init({
    onLoad: 'check-sso',
    silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
    pkceMethod: 'S256',
    checkLoginIframe: false,
  });

  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error("Keycloak initialization timed out")), 2000)
  );

  return Promise.race([initPromise, timeoutPromise]).then((authenticated) => {
    if (authenticated) {
      store.dispatch(setAuth({
        token: keycloak.token || '',
        refreshToken: keycloak.refreshToken || '',
        user: {
          id: keycloak.tokenParsed?.sub || '',
          username: keycloak.tokenParsed?.preferred_username || '',
          email: keycloak.tokenParsed?.email || '',
          firstName: keycloak.tokenParsed?.given_name || '',
          lastName: keycloak.tokenParsed?.family_name || '',
        },
      }));
    } else {
      // Only clear if we don't have a manual token in store
      if (!store.getState().auth.token) {
        store.dispatch(clearAuth());
      }
    }

    // Refresh token periodically
    setInterval(() => {
      keycloak.updateToken(70).then((refreshed) => {
        if (refreshed) {
          store.dispatch(setAuth({
            token: keycloak.token || '',
            refreshToken: keycloak.refreshToken || '',
            user: {
              id: keycloak.tokenParsed?.sub || '',
              username: keycloak.tokenParsed?.preferred_username || '',
              email: keycloak.tokenParsed?.email || '',
              firstName: keycloak.tokenParsed?.given_name || '',
              lastName: keycloak.tokenParsed?.family_name || '',
            },
          }));
        }
      }).catch(() => {
        console.error('Failed to refresh token');
      });
    }, 60000);

    return authenticated;
  }).catch((err) => {
    console.error('Keycloak init failed', err);
    return false;
  });
};

export const loginWithKeycloak = () => keycloak.login();
export const logout = () => {
  store.dispatch(clearAuth());
  if (keycloak.authenticated) {
    keycloak.logout({ redirectUri: window.location.origin + '/login' });
  } else {
    window.location.href = '/login';
  }
};

export default keycloak;
