import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

const manifestLink = document.createElement("link");
manifestLink.rel = "manifest";
manifestLink.href = "/manifest.webmanifest";
document.head.appendChild(manifestLink);

const themeColor = document.createElement("meta");
themeColor.name = "theme-color";
themeColor.content = "#238f87";
document.head.appendChild(themeColor);

const clearLocalServiceWorkers = async () => {
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));

  if ("caches" in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.filter((name) => name.startsWith("medimind-")).map((name) => caches.delete(name)));
  }
};

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Service worker registration failed:", error);
    });
  });
} else if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    clearLocalServiceWorkers().catch((error) => {
      console.warn("Could not clear local service worker cache:", error);
    });
  });
}
