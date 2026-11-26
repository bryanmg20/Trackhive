import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

/*
 * jsdom has no modal <dialog>. This minimal stand-in covers what the
 * screens rely on: `open`, the focus moving inside on showModal(), and
 * Escape firing a cancelable `cancel` event (closing unless prevented).
 */
if (typeof HTMLDialogElement.prototype.showModal !== 'function') {
  const FOCUSABLE =
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  HTMLDialogElement.prototype.showModal = function showModal(
    this: HTMLDialogElement,
  ) {
    this.setAttribute('open', '');
    const first =
      this.querySelector<HTMLElement>('[autofocus]') ??
      this.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
  };
  HTMLDialogElement.prototype.close = function close(
    this: HTMLDialogElement,
  ) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const open = document.querySelectorAll<HTMLDialogElement>('dialog[open]');
    const top = open[open.length - 1];
    if (!top) return;
    const cancel = new Event('cancel', { cancelable: true });
    if (top.dispatchEvent(cancel)) top.close();
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
