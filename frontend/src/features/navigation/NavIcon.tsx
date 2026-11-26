import type { SectionIcon } from './sections';

/** Line icons of the wireframe menu (docs/tools/wireframe-theme.mjs). */
const PATHS: Record<SectionIcon | 'menu' | 'close' | 'logout', string> = {
  home: 'M2 11l10-9 10 9 M5 10v12h14V10 M10 22v-8h4v8',
  file: 'M6 2h9l5 5v15H6z M14 2v6h6 M9 12h8 M9 16h8',
  box: 'M3 7h18v15H3z M2 3h20v4H2z M9 12h6',
  calendar: 'M3 5h18v17H3z M7 2v6 M17 2v6 M3 11h18',
  user: 'M16 7a4 4 0 1 1-8 0a4 4 0 1 1 8 0 M4 22v-3a8 8 0 0 1 16 0v3',
  users:
    'M13 7a4 4 0 1 1-8 0a4 4 0 1 1 8 0 M1 22v-3a8 8 0 0 1 16 0v3 M16 3a4 4 0 0 1 0 8 M20 22v-3a8 8 0 0 0-3-6',
  chart: 'M3 3v19h19 M7 16v-5 M12 16V7 M17 16v-8',
  clock: 'M21 12a9 9 0 1 1-18 0a9 9 0 1 1 18 0 M12 7v5l3 3',
  settings:
    'M12 3v3 M12 18v3 M3 12h3 M18 12h3 M5 5l3 3 M16 16l3 3 M5 19l3-3 M16 8l3-3 M16 12a4 4 0 1 1-8 0a4 4 0 1 1 8 0',
  sync: 'M20 11a8 8 0 0 0-14-5l-2 2 M4 3v5h5 M4 13a8 8 0 0 0 14 5l2-2 M20 21v-5h-5',
  menu: 'M3 6h18 M3 12h18 M3 18h18',
  close: 'M5 5l14 14 M19 5L5 19',
  logout: 'M9 21H4V3h5 M16 17l5-5-5-5 M21 12H9',
};

interface NavIconProps {
  name: keyof typeof PATHS;
  className?: string;
}

export function NavIcon({ name, className }: NavIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
