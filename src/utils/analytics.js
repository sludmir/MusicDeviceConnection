import { getAnalytics, isSupported, logEvent } from 'firebase/analytics';
import { app } from '../firebaseConfig';

// GA4 via Firebase Analytics. No-ops when measurementId is absent (e.g. local
// dev without the env var) or the environment doesn't support analytics
// (Safari private mode, emulators), so callers never need to guard.
let analytics = null;
const ready = app.options.measurementId
  ? isSupported()
      .then((ok) => {
        if (ok) analytics = getAnalytics(app);
        return analytics;
      })
      .catch(() => null)
  : Promise.resolve(null);

export async function trackPageView(path) {
  const instance = await ready;
  if (!instance) return;
  logEvent(instance, 'page_view', {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
}

export async function trackEvent(name, params = {}) {
  const instance = await ready;
  if (!instance) return;
  logEvent(instance, name, params);
}
