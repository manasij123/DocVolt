import { useEffect, useState } from "react";

// Chrome/Edge fire this non-standard event when the site is installable.
// We stash it in state so a custom "Install Desktop App" button can invoke
// it on user click (browser requires a user gesture to show the prompt).
type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type InstallState =
  | "unavailable"           // browser doesn't support PWA install (Safari macOS, older browsers)
  | "available"             // beforeinstallprompt fired — button will trigger prompt
  | "installed"             // already installed (standalone mode detected)
  | "ios-manual";           // iOS Safari — must install via Share → Add to Home Screen

/** Detect whether the web app is currently running as an installed PWA. */
function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // iOS Safari exposes navigator.standalone, everyone else uses display-mode.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const iosStandalone = !!(window.navigator as any).standalone;
  const mqStandalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.matchMedia?.("(display-mode: window-controls-overlay)").matches ||
    window.matchMedia?.("(display-mode: minimal-ui)").matches;
  return iosStandalone || !!mqStandalone;
}

/** Detect iOS Safari — install flow there requires manual user action. */
function isIosSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return ios;
}

/**
 * React hook for the PWA "Install as desktop/laptop app" flow.
 *
 * Usage:
 *   const { state, promptInstall } = useInstallPrompt();
 *   <button onClick={promptInstall} disabled={state === "installed"}>Install</button>
 */
export function useInstallPrompt() {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [state, setState] = useState<InstallState>("unavailable");

  useEffect(() => {
    if (detectStandalone()) {
      setState("installed");
      return;
    }
    if (isIosSafari()) {
      setState("ios-manual");
    }

    const onBIP = (e: Event) => {
      // Stash event so we can fire it on user click (browser requires a gesture).
      e.preventDefault();
      setEvt(e as BIPEvent);
      setState("available");
    };
    const onInstalled = () => {
      setEvt(null);
      setState("installed");
    };
    window.addEventListener("beforeinstallprompt", onBIP as EventListener);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP as EventListener);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
    if (!evt) return "unavailable";
    try {
      await evt.prompt();
      const choice = await evt.userChoice;
      setEvt(null);
      if (choice.outcome === "accepted") {
        setState("installed");
      }
      return choice.outcome;
    } catch {
      return "unavailable";
    }
  }

  return { state, promptInstall };
}
