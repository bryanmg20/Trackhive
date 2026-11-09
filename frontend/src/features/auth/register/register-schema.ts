import { z } from 'zod';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Same limit as the backend (NAME_MAX_LENGTH, issue #96)
export const NAME_MAX_LENGTH = 40;

const tooLongMessage = (label: string) =>
  `${label} no puede superar los ${NAME_MAX_LENGTH} caracteres.`;

const requiredName = (missingMessage: string, label: string) =>
  z
    .string()
    .trim()
    .min(1, missingMessage)
    .max(NAME_MAX_LENGTH, tooLongMessage(label));

// Optional names may stay blank; the page leaves them out of the request
const optionalName = (label: string) =>
  z.string().trim().max(NAME_MAX_LENGTH, tooLongMessage(label));

export const registerSchema = z
  .object({
    firstName: requiredName('Escriba su primer nombre.', 'El primer nombre'),
    middleName: optionalName('El segundo nombre'),
    lastName: requiredName('Escriba su primer apellido.', 'El primer apellido'),
    secondLastName: optionalName('El segundo apellido'),
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
    acceptedPrivacy: z
      .boolean()
      .refine(
        (accepted) => accepted,
        'Debe aceptar el aviso de privacidad para crear su cuenta.',
      ),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Las contraseñas no coinciden.',
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;
