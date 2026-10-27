import { BadRequestException } from '@nestjs/common';
import type { ErrorExtras } from './error-extras.js';

export interface ValidationDetail {
  path: string;
  message: string;
}

export class ValidationException extends BadRequestException implements ErrorExtras {
  readonly extras: { details: ValidationDetail[] };

  constructor(details: ValidationDetail[]) {
    super('Invalid input');
    this.extras = { details };
  }
}
