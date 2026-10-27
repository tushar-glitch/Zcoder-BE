import { IsEmail, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { describe, expect, it } from 'vitest';
import { ValidationException } from '../exceptions/validation.exception.js';
import { createValidationPipe } from './validation.pipe.js';

class AddressDto {
  @IsString()
  city!: string;
}

class SignupDto {
  @IsEmail()
  email!: string;

  @ValidateNested()
  @Type(() => AddressDto)
  address!: AddressDto;
}

const transform = (value: unknown) =>
  createValidationPipe().transform(value, { type: 'body', metatype: SignupDto });

describe('createValidationPipe', () => {
  it('returns a typed instance for valid input', async () => {
    const result = await transform({ email: 'a@b.com', address: { city: 'Pune' } });

    expect(result).toBeInstanceOf(SignupDto);
  });

  it('reports every failing field with its path', async () => {
    const error = await transform({ email: 'nope', address: { city: 1 } }).catch((e) => e);

    expect(error).toBeInstanceOf(ValidationException);
    expect(error.extras.details.map((d: { path: string }) => d.path).sort()).toEqual(['address.city', 'email']);
  });

  it('rejects unknown fields', async () => {
    const error = await transform({ email: 'a@b.com', address: { city: 'Pune' }, admin: true }).catch((e) => e);

    expect(error.extras.details).toEqual([{ path: 'admin', message: 'property admin should not exist' }]);
  });
});
