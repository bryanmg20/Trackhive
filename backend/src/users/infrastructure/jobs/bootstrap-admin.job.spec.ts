import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { BootstrapAdminUseCase } from '../../application/use-cases/bootstrap-admin.use-case';
import { BootstrapAdminJob } from './bootstrap-admin.job';

const build = (env: Record<string, string | undefined>) => {
  const execute = jest.fn(() => Promise.resolve(true));
  const job = new BootstrapAdminJob(new ConfigService(env), {
    execute,
  } as unknown as BootstrapAdminUseCase);
  return { job, execute };
};

describe('BootstrapAdminJob (HU-42)', () => {
  let logError: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    logError = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  it('requires a strong password unless RUN_SEED=true', async () => {
    const production = build({
      ADMIN_EMAIL: ' admin@clena.org ',
      ADMIN_PASSWORD: 'una-clave-larga',
      RUN_SEED: 'false',
    });
    await production.job.run();
    expect(production.execute).toHaveBeenCalledWith({
      email: 'admin@clena.org',
      password: 'una-clave-larga',
      requireStrongPassword: true,
    });

    const development = build({
      ADMIN_EMAIL: 'admin@example.com',
      ADMIN_PASSWORD: '1',
      RUN_SEED: 'true',
    });
    await development.job.run();
    expect(development.execute).toHaveBeenCalledWith(
      expect.objectContaining({ requireStrongPassword: false }),
    );
  });

  it.each([
    { ADMIN_PASSWORD: 'una-clave-larga' },
    { ADMIN_EMAIL: 'admin@clena.org' },
    { ADMIN_EMAIL: ' ', ADMIN_PASSWORD: 'una-clave-larga' },
  ])(
    'stops the start when ADMIN_EMAIL or ADMIN_PASSWORD is missing (%o)',
    async (env) => {
      const { job, execute } = build({ RUN_SEED: 'false', ...env });

      await expect(job.run()).rejects.toThrow(/ADMIN_EMAIL or ADMIN_PASSWORD/);
      expect(execute).not.toHaveBeenCalled();
    },
  );

  it('logs and rethrows when the use case fails', async () => {
    const { job, execute } = build({
      ADMIN_EMAIL: 'admin@clena.org',
      ADMIN_PASSWORD: 'corta',
      RUN_SEED: 'false',
    });
    execute.mockRejectedValue(
      new Error('ADMIN_PASSWORD debe tener al menos 12'),
    );

    await expect(job.run()).rejects.toThrow('ADMIN_PASSWORD debe tener');
    expect(logError).toHaveBeenCalled();
  });
});
