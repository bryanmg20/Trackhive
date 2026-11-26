import { useEffect, useRef } from 'react';

/**
 * Opens a native <dialog> as modal while the component is mounted.
 *
 * `showModal()` gives the accessible behaviour for free: the focus moves
 * into the dialog, Tab cannot leave it, the rest of the page becomes inert
 * and Escape fires a `cancel` event (handle it with `onCancel`). When the
 * component unmounts the focus returns to the control that opened it.
 */
export function useModalDialog() {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) {
      return undefined;
    }
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (!dialog.open) {
      dialog.showModal();
    }

    return () => {
      if (dialog.open) {
        dialog.close();
      }
      // The opener can disappear (e.g. «Registrar entrega» turns into
      // «Registrar devolución»); then the screen decides where focus goes.
      if (opener?.isConnected) {
        opener.focus();
      }
    };
  }, []);

  return ref;
}
