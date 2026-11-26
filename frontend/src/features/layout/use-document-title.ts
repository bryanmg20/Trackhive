import { useEffect } from 'react';

export const APP_NAME = 'Trackhive';

/** Text of the browser tab: «<page> · Trackhive», or the app name alone. */
export function formatDocumentTitle(title?: string): string {
  return title ? `${title} · ${APP_NAME}` : APP_NAME;
}

/**
 * Names the browser tab after the screen (WCAG 2.4.2 «Page Titled»): screen
 * readers announce it on every route change, and the history and tab list
 * stop showing the same title for every screen.
 */
export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = formatDocumentTitle(title);
  }, [title]);
}
