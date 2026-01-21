// gameVersion.ts

// Exported global variable, readable everywhere
export let gameVersion: string | null = null;

/**
 * Initialise `gameVersion` en scannant les <script> de la page.
 * Call in client main (after game scripts are present).
 */
export function initGameVersion(doc?: Document): void {
  // If already initialized, don't redo the work
  if (gameVersion !== null) {
    return;
  }

  const d = doc ?? (typeof document !== "undefined" ? document : null);
  if (!d) {
    // En environnement non-browser / SSR, on ne fait rien
    return;
  }

  const scripts = d.scripts;
  for (let i = 0; i < scripts.length; i++) {
    const script = scripts.item(i) as HTMLScriptElement | null;
    if (!script) continue;

    const src = script.src;
    if (!src) continue;

    // Match: /version/<hash>/... ou /r/12345/version/<hash>/...
    const match = src.match(/\/(?:r\/\d+\/)?version\/([^/]+)/);
    if (match && match[1]) {
      gameVersion = match[1];
      return;
    }
  }

  // If nothing found, gameVersion stays null
}
