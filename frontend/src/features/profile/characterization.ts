import { z } from 'zod';

export const AGE_RANGES = [
  '0-5',
  '6-11',
  '12-17',
  '18-28',
  '29-59',
  '60+',
] as const;
export const AGE_RANGE_LABELS = [
  '0–5',
  '6–11',
  '12–17',
  '18–28',
  '29–59',
  '60 o más',
];
export const POPULATION_GROUPS = [
  { value: 'COMUNIDADES_NEGRAS_PALENQUERAS', label: 'C. NEGRAS P/QUERAS' },
  { value: 'PUEBLOS_INDIGENAS', label: 'PUEBLOS INDÍGENAS' },
  { value: 'DISCAPACIDAD', label: 'POBLACIÓN EN SIT. DE DISCA.' },
  { value: 'MIGRANTE', label: 'MIGRANTE' },
  { value: 'PUEBLOS_ROM', label: 'PUEBLOS ROM' },
  { value: 'VICTIMAS_DEL_CONFLICTO', label: 'VÍCTIMAS DEL CONFLICTO' },
  { value: 'COMUNIDADES_RURALES', label: 'COMUNIDADES RURALES' },
  { value: 'MADRES_CABEZA_DE_FAMILIA', label: 'MADRES CABEZA DE FAMILIA' },
  { value: 'PADRES_CABEZA_DE_FAMILIA', label: 'PADRES CABEZA DE FAMILIA' },
  { value: 'LGBTIQ_PLUS', label: 'LGBTIQ+' },
  { value: 'PREFIERO_NO_RESPONDER', label: 'PREFIERO NO RESPONDER' },
] as const;

export const characterizationSchema = z.object({
  municipality: z
    .string()
    .trim()
    .min(1, 'Escriba su municipio o distrito.')
    .max(120, 'Use como máximo 120 caracteres.'),
  ageRange: z
    .string()
    .refine(
      (value) => (AGE_RANGES as readonly string[]).includes(value),
      'Seleccione su rango de edad.',
    ),
  populationGroup: z
    .string()
    .refine(
      (value) =>
        value === '' ||
        POPULATION_GROUPS.some((group) => group.value === value),
      'Seleccione un grupo poblacional válido.',
    )
    .optional(),
});

export type CharacterizationValues = z.infer<typeof characterizationSchema>;
