import { z } from 'zod';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(1, 'Escriba su nombre completo.')
      .min(2, 'El nombre debe tener al menos 2 caracteres.')
      .max(120, 'El nombre no puede superar los 120 caracteres.'),
    email: z
      .string()
      .trim()
      .min(1, 'Escriba su correo electrónico.')
      .max(160, 'El correo no puede superar los 160 caracteres.')
      .regex(EMAIL_PATTERN, 'Escriba un correo válido.'),
    password: z
      .string()
      .min(1, 'Cree una contraseña.')
      .min(8, 'Use al menos 8 caracteres.')
      .max(128, 'La contraseña no puede superar los 128 caracteres.'),
    confirmPassword: z.string().min(1, 'Repita su contraseña.'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Las contraseñas no coinciden.',
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;
