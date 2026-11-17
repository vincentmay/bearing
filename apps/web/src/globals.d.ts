/** The moment this build of the app was made, put in by the build (see vite.config.ts). */
declare const __BUILD__: string;

interface Window {
  /** Load the app afresh after a moment, a few times at most; set by the page's own script. */
  bearingAgain?: () => void;
}
