import { Logger } from '@nestjs/common';
import { SendPendingNotificationsJob } from './send-pending-notifications.job';
import type {
  SendPendingNotificationsResult,
  SendPendingNotificationsUseCase,
} from '../../application/use-cases/send-pending-notifications.use-case';

describe('SendPendingNotificationsJob', () => {
  let execute: jest.Mock<Promise<SendPendingNotificationsResult>, []>;
  let job: SendPendingNotificationsJob;
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    execute = jest.fn(() =>
      Promise.resolve({ sent: 2, retrying: 1, failed: 0 }),
    );
    job = new SendPendingNotificationsJob({
      execute,
    } as unknown as SendPendingNotificationsUseCase);
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends the pending emails and logs how it went', async () => {
    await job.run();

    expect(execute).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(
      'Emails to requesters: 2 sent, 1 to retry, 0 failed',
    );
  });

  it('logs nothing when there was nothing to send', async () => {
    execute.mockResolvedValueOnce({ sent: 0, retrying: 0, failed: 0 });

    await job.run();

    expect(logSpy).not.toHaveBeenCalled();
  });

  it('logs a failed run instead of stopping the app', async () => {
    execute.mockRejectedValueOnce(new Error('database down'));

    await expect(job.run()).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(
      'Could not process the pending emails',
      expect.stringContaining('database down'),
    );
  });

  it('does not start a run while the previous one is still sending', async () => {
    let finish: () => void = () => undefined;
    execute.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ sent: 1, retrying: 0, failed: 0 });
        }),
    );

    const slow = job.run();
    await job.run();
    finish();
    await slow;
    await job.run();

    // The second call returned at once; the third one ran again
    expect(execute).toHaveBeenCalledTimes(2);
  });
});
