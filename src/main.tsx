import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { store } from './store'
import { initKeycloak } from './auth/keycloak'
import './index.css'
import App from './App.tsx'

console.log("App starting...");

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error("Root element not found!");
} else {
  const root = createRoot(rootElement);
  document.documentElement.classList.add('dark');

  root.render(
    <div className="flex h-screen w-full items-center justify-center bg-[#08060d] text-white">
      <div className="animate-pulse text-2xl font-bold tracking-tighter">VOYAGRR</div>
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
        <div>
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
