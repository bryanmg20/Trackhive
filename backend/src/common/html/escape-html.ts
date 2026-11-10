/**
 * Escapes a value written by a person (a name, a title, a reason) before it
 * goes into the HTML of an email, so it cannot inject markup.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
