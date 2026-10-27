import { HttpException, HttpStatus } from '@nestjs/common';
import type { ErrorExtras } from '../../../common/exceptions/error-extras.js';

export class AccountLockedException extends HttpException implements ErrorExtras {
  readonly extras: { retryAfterSeconds: number };

  constructor(retryAfterSeconds: number) {
    super('Account is locked', HttpStatus.LOCKED);
    this.extras = { retryAfterSeconds };
  }
}
