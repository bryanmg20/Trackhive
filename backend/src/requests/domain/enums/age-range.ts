export const AGE_RANGES = [
  '0-5',
  '6-11',
  '12-17',
  '18-28',
  '29-59',
  '60+',
] as const;
export type AgeRange = (typeof AGE_RANGES)[number];
