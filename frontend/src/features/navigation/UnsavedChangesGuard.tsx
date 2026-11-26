import { useContext, useEffect } from 'react';
import { UNSAFE_DataRouterContext, useBlocker } from 'react-router-dom';
import { ROUTES } from '../../routes';

export const UNSAVED_CHANGES_MESSAGE =
  'Tiene cambios sin guardar. Si sale de esta pantalla se perderán. ¿Desea salir de todos modos?';

interface UnsavedChangesGuardProps {
  /** True while the form holds data that has not been sent. */
  when: boolean;
}

/**
 * Asks before leaving a form with unsaved data: closing or reloading the tab
 * (the browser's own prompt) and moving to another screen of the app.
 *
 * The in-app part needs the data router of `main.tsx`; under a plain
 * <MemoryRouter> (unit tests of a single screen) only the tab prompt runs.
 */
export function UnsavedChangesGuard({ when }: UnsavedChangesGuardProps) {
  const isDataRouter = useContext(UNSAFE_DataRouterContext) !== null;

  useEffect(() => {
    if (!when) {
      return undefined;
    }
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Older browsers still need a value to show the prompt
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [when]);

  return isDataRouter ? <NavigationBlocker when={when} /> : null;
}

function NavigationBlocker({ when }: UnsavedChangesGuardProps) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      when &&
      currentLocation.pathname !== nextLocation.pathname &&
      // Logging out or an expired session: staying would not save anything
      nextLocation.pathname !== ROUTES.login,
  );

  useEffect(() => {
    if (blocker.state !== 'blocked') {
      return;
    }
    if (window.confirm(UNSAVED_CHANGES_MESSAGE)) {
      blocker.proceed();
    } else {
      blocker.reset();
    }
  }, [blocker]);

  return null;
}
