import {
  DEFAULT_RUN_TIMEOUT_MINUTES,
  DEVELOPMENT_AGENT_TOKEN,
  loadEverythingSyncConfig,
  MIN_AGENT_TOKEN_LENGTH,
} from './everything-sync.config';

const TOKEN = 'f'.repeat(64);

const configFrom = (env: Record<string, string | undefined>) =>
  loadEverythingSyncConfig((key) => env[key]);

describe('loadEverythingSyncConfig', () => {
  it('lee el token del agente y el plazo de las corridas', () => {
    expect(
      configFrom({
        EVERYTHING_AGENT_TOKEN: ` ${TOKEN} `,
        EVERYTHING_RUN_TIMEOUT_MINUTES: '45',
      }),
    ).toEqual({ agentToken: TOKEN, runTimeoutMinutes: 45 });
  });

  it.each([
    ['sin la variable', undefined],
    ['vacía', ''],
    ['en blanco', '   '],
  ])('sin token (%s) la sincronización queda desactivada', (_case, token) => {
    expect(configFrom({ EVERYTHING_AGENT_TOKEN: token }).agentToken).toBeNull();
  });

  it(`sin plazo usa ${DEFAULT_RUN_TIMEOUT_MINUTES} minutos`, () => {
    expect(configFrom({}).runTimeoutMinutes).toBe(DEFAULT_RUN_TIMEOUT_MINUTES);
  });

  it(`no arranca con un token de menos de ${MIN_AGENT_TOKEN_LENGTH} caracteres`, () => {
    expect(() =>
      configFrom({
        EVERYTHING_AGENT_TOKEN: 'x'.repeat(MIN_AGENT_TOKEN_LENGTH - 1),
      }),
    ).toThrow(/EVERYTHING_AGENT_TOKEN/);
  });

  it('acepta el token público de .env.example en desarrollo (RUN_SEED=true)', () => {
    expect(
      configFrom({
        EVERYTHING_AGENT_TOKEN: DEVELOPMENT_AGENT_TOKEN,
        RUN_SEED: 'true',
      }).agentToken,
    ).toBe(DEVELOPMENT_AGENT_TOKEN);
  });

  it.each([
    ['RUN_SEED=false', 'false'],
    ['sin RUN_SEED', undefined],
  ])(
    'no arranca con el token público de .env.example en producción (%s)',
    (_case, runSeed) => {
      expect(() =>
        configFrom({
          EVERYTHING_AGENT_TOKEN: ` ${DEVELOPMENT_AGENT_TOKEN} `,
          RUN_SEED: runSeed,
        }),
      ).toThrow(/EVERYTHING_AGENT_TOKEN es el de \.env\.example/);
    },
  );

  it('con RUN_SEED=false acepta un token propio', () => {
    expect(
      configFrom({ EVERYTHING_AGENT_TOKEN: TOKEN, RUN_SEED: 'false' })
        .agentToken,
    ).toBe(TOKEN);
  });

  it.each(['0', '-5', '1.5', 'media hora'])(
    'no arranca con el plazo %s',
    (timeout) => {
      expect(() =>
        configFrom({ EVERYTHING_RUN_TIMEOUT_MINUTES: timeout }),
      ).toThrow(/EVERYTHING_RUN_TIMEOUT_MINUTES/);
    },
  );
});
