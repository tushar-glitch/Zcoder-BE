import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { Paginated } from '../pagination/paginated.js';
import { ResponseEnvelopeInterceptor } from './response-envelope.interceptor.js';

function intercept(result: unknown): Promise<unknown> {
  const next: CallHandler = { handle: () => of(result) };
  return lastValueFrom(new ResponseEnvelopeInterceptor().intercept({} as ExecutionContext, next));
}

describe('ResponseEnvelopeInterceptor', () => {
  it('wraps a result in data', async () => {
    expect(await intercept({ id: 1 })).toEqual({ data: { id: 1 } });
  });

  it('puts a paginated result in data with its meta', async () => {
    const page = Paginated.of(['a'], 1, { page: 1, pageSize: 20 });

    expect(await intercept(page)).toEqual({
      data: ['a'],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
  });

  it('leaves an empty result empty', async () => {
    expect(await intercept(undefined)).toBeUndefined();
  });
});
