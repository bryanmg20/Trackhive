import { z } from 'zod';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Escriba su correo electrónico.')
    .regex(EMAIL_PATTERN, 'Escriba un correo válido.'),
  // No length rules: the backend answers 401 for any wrong password.
  password: z.string().min(1, 'Escriba su contraseña.'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
