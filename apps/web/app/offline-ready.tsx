"use client";

import { useEffect, useRef, useState } from "react";
import { Download, RefreshCw, WifiOff, X } from "lucide-react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function OfflineReady() {
  const [offline, setOffline] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent>();
  const [installed, setInstalled] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration>();
  const reloadForUpdate = useRef(false);

  useEffect(() => {
    const updateOnlineState = () => setOffline(!navigator.onLine);
    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(undefined);
    };
    const onControllerChange = () => {
      if (reloadForUpdate.current) window.location.reload();
    };

    updateOnlineState();
    window.addEventListener("online", updateOnlineState);
    window.addEventListener("offline", updateOnlineState);
    window.addEventListener("beforeinstallprompt", onInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    navigator.serviceWorker?.addEventListener("controllerchange", onControllerChange);

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").then((registration) => {
        registrationRef.current = registration;
        if (registration.waiting && navigator.serviceWorker.controller) setUpdateReady(true);
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) setUpdateReady(true);
          });
        });
        void registration.update().catch(() => undefined);
      }).catch(() => undefined);
    }

    return () => {
      window.removeEventListener("online", updateOnlineState);
      window.removeEventListener("offline", updateOnlineState);
      window.removeEventListener("beforeinstallprompt", onInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      navigator.serviceWorker?.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "dismissed") setInstallDismissed(true);
    setInstallPrompt(undefined);
  }

  function applyUpdate() {
    const worker = registrationRef.current?.waiting;
    if (!worker) return;
    reloadForUpdate.current = true;
    worker.postMessage({ type: "SKIP_WAITING" });
  }

  const showInstall = Boolean(installPrompt && !installed && !installDismissed);
  if (!offline && !showInstall && !updateReady) return null;

  return (
    <aside className="pwa-status-stack" aria-label="应用状态 / App status">
      {offline && <div className="offline-status" role="status" aria-live="polite"><WifiOff size={14} />离线模式 · Offline</div>}
      {updateReady && <div className="pwa-action-card update" role="status"><RefreshCw size={17} /><span><strong>新版本已准备好</strong><small>Update ready</small></span><button onClick={applyUpdate}>立即更新</button></div>}
      {showInstall && <div className="pwa-action-card"><Download size={17} /><span><strong>安装到设备</strong><small>离线打开更方便 · Install app</small></span><button onClick={() => void installApp()}>安装</button><button className="dismiss" onClick={() => setInstallDismissed(true)} aria-label="稍后安装"><X size={14} /></button></div>}
    </aside>
  );
}
