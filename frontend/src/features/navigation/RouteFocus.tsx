import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { formatDocumentTitle } from '../layout/use-document-title';

/**
 * Route change handling for keyboard and screen reader users.
 *
 * In a single-page app the focus stays on the link that was pressed and
 * nothing announces the new screen. After each change of path this moves
 * the focus to the screen's <h1> (or its <main>), so the reader starts at
 * the new content.
 *
 * It must render BEFORE <Routes>: React runs sibling effects in order, so
 * the generic title set here is replaced by the one each screen sets with
 * `useDocumentTitle`, and a screen without one never keeps a stale title.
 */
export function RouteFocus() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  const previousPath = useRef(pathname);

  useEffect(() => {
    if (previousPath.current === pathname) {
      return;
    }
    previousPath.current = pathname;
    document.title = formatDocumentTitle();

    // A redirect on first load (e.g. «/» to the role's home) happens before
    // the person has focused anything: leave the focus at the top of the
    // page so the «Saltar al contenido» link stays the first stop.
    const nothingFocused =
      document.activeElement === null ||
      document.activeElement === document.body;
    if (navigationType === 'REPLACE' && nothingFocused) {
      return;
    }

    const main = document.querySelector('main');
    const target = main?.querySelector('h1') ?? main;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    if (!target.hasAttribute('tabindex')) {
      target.setAttribute('tabindex', '-1');
    }
    target.focus();
  }, [pathname, navigationType]);

  return null;
}
