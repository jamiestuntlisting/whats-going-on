// Track event IDs the user has dismissed (left-swiped). Persisted in
// localStorage so dismissals stick across reloads. Pure helpers — call them
// from a client component.

const KEY = 'wgo:dismissed-events';

export function loadDismissed(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((x): x is string => typeof x === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

export function saveDismissed(ids: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // localStorage may be unavailable (private mode); silently no-op.
  }
}
