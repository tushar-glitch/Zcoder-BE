import { Param, ParseUUIDPipe } from '@nestjs/common';
import { ValidationException } from '../exceptions/validation.exception.js';

export const UuidParam = (name = 'id'): ParameterDecorator =>
  Param(
    name,
    new ParseUUIDPipe({
      exceptionFactory: () => new ValidationException([{ path: name, message: `${name} must be a UUID` }]),
    }),
  );
