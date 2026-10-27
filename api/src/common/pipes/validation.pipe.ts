import { ValidationError, ValidationPipe } from '@nestjs/common';
import { ValidationDetail, ValidationException } from '../exceptions/validation.exception.js';

function flatten(errors: ValidationError[], parentPath = ''): ValidationDetail[] {
  return errors.flatMap(({ property, constraints, children }) => {
    const path = parentPath ? `${parentPath}.${property}` : property;
    const own = Object.values(constraints ?? {}).map((message) => ({ path, message }));
    return [...own, ...flatten(children ?? [], path)];
  });
}

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) => new ValidationException(flatten(errors)),
  });
}
