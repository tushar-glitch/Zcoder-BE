import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { ResponseEnvelopeInterceptor } from './response-envelope.interceptor.js';

function intercept(result: unknown): Promise<unknown> {
  const next: CallHandler = { handle: () => of(result) };
  return lastValueFrom(new ResponseEnvelopeInterceptor().intercept({} as ExecutionContext, next));
}

describe('ResponseEnvelopeInterceptor', () => {
  it('wraps a result in data', async () => {
    expect(await intercept({ id: 1 })).toEqual({ data: { id: 1 } });
  });

  it('leaves an empty result empty', async () => {
    expect(await intercept(undefined)).toBeUndefined();
  });
});
