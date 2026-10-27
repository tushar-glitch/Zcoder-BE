import { ArgumentsHost, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ValidationException } from '../exceptions/validation.exception.js';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

function run(exception: unknown) {
  const response = { setHeader: vi.fn(), status: vi.fn(), json: vi.fn() };
  response.status.mockReturnValue(response);
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ method: 'GET', originalUrl: '/api/v1/x' }),
    }),
  } as unknown as ArgumentsHost;

  new AllExceptionsFilter().catch(exception, host);

  return { status: response.status.mock.calls[0][0], body: response.json.mock.calls[0][0].error, response };
}

describe('AllExceptionsFilter', () => {
  it('maps an HTTP exception to its contract code', () => {
    const { status, body } = run(new NotFoundException('Missing'));

    expect(status).toBe(HttpStatus.NOT_FOUND);
    expect(body).toMatchObject({ code: 'NOT_FOUND', message: 'Missing' });
  });

  it('maps 423 to ACCOUNT_LOCKED', () => {
    expect(run(new HttpException('Locked', HttpStatus.LOCKED)).body.code).toBe('ACCOUNT_LOCKED');
  });

  it('includes the extras an exception exposes', () => {
    const lockedWithRetry = Object.assign(new HttpException('Locked', HttpStatus.LOCKED), { extras: { retryAfterSeconds: 840 } });

    expect(run(lockedWithRetry).body).toMatchObject({ code: 'ACCOUNT_LOCKED', retryAfterSeconds: 840 });
  });

  it('includes validation details', () => {
    const details = [{ path: 'email', message: 'Invalid email' }];
    const { status, body } = run(new ValidationException(details));

    expect(status).toBe(HttpStatus.BAD_REQUEST);
    expect(body).toMatchObject({ code: 'VALIDATION_ERROR', details });
  });

  it('hides the cause of unexpected errors', () => {
    const { status, body } = run(new Error('database password is hunter2'));

    expect(status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(body).toMatchObject({ code: 'INTERNAL_ERROR', message: 'Something went wrong' });
    expect(JSON.stringify(body)).not.toContain('hunter2');
  });

  it('returns the request id in the body and the header', () => {
    const { body, response } = run(new NotFoundException());

    expect(response.setHeader).toHaveBeenCalledWith('x-request-id', body.requestId);
  });
});
