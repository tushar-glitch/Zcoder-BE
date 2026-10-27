import { applyDecorators } from '@nestjs/common';
import { IsOptional, IsUUID, ValidateIf } from 'class-validator';

export const IsOptionalUuid = (): PropertyDecorator =>
  applyDecorators(ValidateIf((_object, value) => value !== undefined), IsUUID());

export const IsNullableUuid = (): PropertyDecorator => applyDecorators(IsOptional(), IsUUID());
