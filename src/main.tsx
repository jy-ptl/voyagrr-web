import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { store } from './store'
import { initKeycloak } from './auth/keycloak'
import './index.css'
import App from './App.tsx'

console.log("App starting...");

const registerServiceWorker = () => {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('Service worker registration failed:', error);
    });
  });
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error("Root element not found!");
} else {
  const root = createRoot(rootElement);
  document.documentElement.classList.add('dark');

  registerServiceWorker();

  root.render(
    <div className="flex h-screen w-full items-center justify-center bg-[#08060d] text-white">
      <div className="flex flex-col items-center gap-4 rounded-3xl border border-white/5 bg-white/[0.03] px-8 py-10 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <img src="/favicon.svg" alt="VOYAGRR" className="h-16 w-16 animate-pulse drop-shadow-[0_0_24px_rgba(134,59,255,0.45)]" />
        <div className="text-center">
          <div className="text-2xl font-black tracking-[0.3em] text-white">VOYAGRR</div>
          <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.35em] text-zinc-500">Preparing your travel workspace</div>
        </div>
      </div>
    </div>
  );

  initKeycloak().then((authenticated) => {
    console.log("Keycloak initialized. Authenticated:", authenticated);
    root.render(
      <StrictMode>
        <Provider store={store}>
          <App />
        </Provider>
      </StrictMode>,
    )
  }).catch((err) => {
    console.error("Keycloak initialization failed:", err);
    root.render(
      <div className="flex h-screen w-full items-center justify-center bg-[#08060d] text-white p-10 text-center">
        <div className="flex max-w-md flex-col items-center gap-5 rounded-3xl border border-white/5 bg-white/[0.03] px-8 py-10 shadow-2xl shadow-black/30 backdrop-blur-xl">
          <img src="/favicon.svg" alt="VOYAGRR" className="h-14 w-14" />
          <div className="text-xl font-medium mb-4 text-red-400">Authentication Error</div>
          <div className="text-muted-foreground text-sm">
            Could not connect to the authentication server. <br/>
            Please ensure Keycloak is running at {import.meta.env.VITE_KEYCLOAK_URL}
          </div>
        </div>
      </div>
    );
  });
}
