// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      "prettier/prettier": ["error", { endOfLine: "auto" }],
    },
  },
  {
    // Clean Architecture: el dominio no importa NestJS ni el ORM
    files: ['src/**/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@nestjs/*'], message: 'El dominio no puede importar NestJS.' },
            { group: ['@prisma/*', 'prisma'], message: 'El dominio no puede importar el ORM.' },
            {
              group: ['class-validator', 'class-transformer', '@nestjs/swagger'],
              message: 'El dominio no conoce la validación ni la documentación HTTP.',
            },
          ],
        },
      ],
    },
  },
  {
    // Clean Architecture (#144): los casos de uso y los servicios de aplicación
    // reciben interfaces ...Input, nunca el DTO de la petición HTTP (D-B)
    files: [
      'src/**/application/use-cases/**/*.ts',
      'src/**/application/services/**/*.ts',
    ],
    ignores: ['**/*.spec.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['class-validator', 'class-transformer', '@nestjs/swagger'],
              message: 'Un caso de uso no conoce la validación ni la documentación HTTP.',
            },
            {
              // Only the response DTOs, which the use case returns
              regex: '(?<!-response)\\.dto$',
              message:
                'Un caso de uso no recibe DTOs de petición: usa una interfaz ...Input (D-B).',
            },
          ],
        },
      ],
    },
  },
  {
    // Los contratos de entrada y de resultado son interfaces planas (D-B)
    files: [
      'src/**/application/dto/*.input.ts',
      'src/**/application/dto/*.result.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['class-validator', 'class-transformer', '@nestjs/swagger'],
              message: 'Un contrato de entrada no lleva decoradores.',
            },
            {
              regex: '\\.dto$',
              message: 'Un contrato de entrada no reutiliza un DTO.',
            },
          ],
        },
      ],
    },
  },
);
