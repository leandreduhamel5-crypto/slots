const KEY = 'codex-infecta:updating';
const CHECK_EVERY = 5 * 60 * 1000;
/** a tab left open only reloads when nobody has touched it for this long */
const IDLE_FOR = 60 * 1000;
const BUILD = /assets\/main-[\w-]+\.js/;

/**
 * Players keep the game open in a tab or on their home screen, for days: a new version has to reach
 * them by itself. The page compares its own build with the one on the server when the player comes
 * back to it, and now and then while it stays open. A reload never falls in the middle of a round.
 */
export function watchForUpdates(playing: () => boolean): void {
  const current = document.querySelector<HTMLScriptElement>('script[src*="assets/main-"]')?.src.match(BUILD)?.[0];
  if (!current) return;
  let lastInput = performance.now();
  for (const e of ['pointerdown', 'keydown']) window.addEventListener(e, () => (lastInput = performance.now()));

  const check = async (returning: boolean): Promise<void> => {
    if (playing()) return;
    try {
      const html = await (await fetch('./', { cache: 'no-store' })).text();
      const latest = html.match(BUILD)?.[0];
      if (!latest || latest === current || playing()) return;
      if (!returning && performance.now() - lastInput < IDLE_FOR) return;
      // once per version: a server still handing out the old page must not cause a loop
      if (sessionStorage.getItem(KEY) === latest) return;
      sessionStorage.setItem(KEY, latest);
      location.reload();
    } catch {
      /* offline, or no storage: the next check will do */
    }
  };

  document.addEventListener('visibilitychange', () => void (document.hidden || check(true)));
  window.addEventListener('pageshow', (e) => void (e.persisted && check(true)));
  setInterval(() => void check(false), CHECK_EVERY);
}
