export type CsvCell = string | number | null;

/** UTF-8 BOM and explicit Excel delimiter, quoted cells and CRLF records. */
export function toCsv(rows: readonly (readonly CsvCell[])[]): string {
  return (
    '\uFEFFsep=,\r\n' +
    rows
      .map((row) =>
        row
          .map((cell) => {
            let value = cell === null ? '' : String(cell);
            // Treat untrusted text as text when opened by a spreadsheet, never a formula.
            if (
              typeof cell === 'string' &&
              (/^\s*[=+\-@]/u.test(value) || /^[\t\r\n]/u.test(value))
            )
              value = "'" + value;
            return '"' + value.replaceAll('"', '""') + '"';
          })
          .join(','),
      )
      .join('\r\n') +
    '\r\n'
  );
}
