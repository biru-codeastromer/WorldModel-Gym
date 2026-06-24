import { THEME_STORAGE_KEY } from "./constants";

/**
 * Inline, render-blocking theme initializer.
 *
 * Renders a single <script> that runs BEFORE first paint to set the
 * `dark` class on <html>, eliminating the flash-of-unstyled-content when the
 * stored/preferred theme is dark. It is nonce-tagged so it satisfies the
 * nonce-based CSP defined in middleware.ts — the caller (root layout) reads the
 * per-request nonce from `headers().get("x-nonce")` and forwards it here.
 *
 * The script body is a static string literal (no user/runtime interpolation),
 * so it is safe to inject via dangerouslySetInnerHTML.
 */
export function ThemeScript({ nonce }: { nonce?: string }) {
  const js = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var s=localStorage.getItem(k);var m=window.matchMedia("(prefers-color-scheme: dark)").matches;var d=s==="dark"||((s===null||s==="system")&&m);var e=document.documentElement;e.classList.toggle("dark",d);e.style.colorScheme=d?"dark":"light";}catch(_){}})();`;
  return <script nonce={nonce} dangerouslySetInnerHTML={{ __html: js }} />;
}
