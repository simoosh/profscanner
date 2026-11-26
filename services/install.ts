/**
 * Install / full-screen helpers.
 *
 * A web page cannot hide the browser's address bar by itself (Chrome and Safari forbid it).
 * What works:
 *  - installing the app (PWA): it then opens in its own window, with no browser bars;
 *  - on Android Chrome, the Fullscreen API, started by a tap, hides the bars until the user leaves.
 *  - iOS Safari has no install prompt and no Fullscreen API on iPhone: the user adds the page to
 *    the home screen from the Share menu.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); // keep the event: the prompt is shown from our own button
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
  document.addEventListener('fullscreenchange', notify);
}

/** True when running as an installed app (no browser bars). */
export const isStandalone = (): boolean =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.matchMedia('(display-mode: fullscreen)').matches ||
  (navigator as any).standalone === true;

export const isIOS = (): boolean =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  // iPadOS reports itself as a Mac with a touch screen
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const isMobileDevice = (): boolean =>
  /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && window.innerWidth < 900);

export const canPromptInstall = (): boolean => deferredPrompt !== null;

/** Shows the browser's install dialog. Resolves to true when the user accepted. */
export const promptInstall = async (): Promise<boolean> => {
  if (!deferredPrompt) return false;
  const event = deferredPrompt;
  deferredPrompt = null;
  await event.prompt();
  const { outcome } = await event.userChoice;
  notify();
  return outcome === 'accepted';
};

export const canFullscreen = (): boolean => !!document.documentElement.requestFullscreen;
export const isFullscreen = (): boolean => !!document.fullscreenElement;

export const toggleFullscreen = async (): Promise<void> => {
  if (document.fullscreenElement) await document.exitFullscreen();
  else await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
};

/** Subscribes to anything that changes install/full-screen availability. Returns the unsubscribe function. */
export const onInstallStateChange = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
