/**
 * The server-rendered shell.
 *
 * /api/meta paints real content into #ssr-shell so a crawler — and a human on
 * a slow connection — sees the term, the layer or the home copy at FCP rather
 * than an empty div. Previously that content went into #root, which
 * createRoot() clears on mount: the text appeared at ~2.0s, vanished, and did
 * not come back until the lazy view resolved. On a cold deep-link over Slow 4G
 * that blank stretch measured 2,907ms, and it landed on exactly the visitors
 * arriving from a shared link.
 *
 * Now the shell is a sibling that sits above #root and is removed only once
 * the view matching the URL has actually painted. So the content is continuous:
 * server-rendered text, then the real thing, with nothing in between.
 *
 * If the entry chunk never loads or throws, the shell simply stays. A readable
 * page with no interactivity beats a blank one, and that is strictly better
 * than the previous behaviour, where a failed boot left an empty div.
 */

const SHELL_ID = "ssr-shell";

/**
 * Removed on the frame AFTER the view reports ready, never the same one.
 * Dismissing synchronously races the commit: React has rendered but the
 * browser has not painted, so the shell can disappear a frame before its
 * replacement exists — which is the blank window again, just shorter.
 */
export function dismissSsrShell(): void {
  const shell = document.getElementById(SHELL_ID);
  if (!shell) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => shell.remove());
  });
}
