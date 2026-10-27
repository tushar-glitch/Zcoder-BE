import { applyDecorators } from '@nestjs/common';
import { ArrayMaxSize, ArrayUnique, IsArray, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export const IsStringList = (maxItems: number, maxLength: number): PropertyDecorator =>
  applyDecorators(IsOptional(), IsArray(), ArrayMaxSize(maxItems), ArrayUnique(), IsString({ each: true }), MaxLength(maxLength, { each: true }));

export const IsHttpUrl = (): PropertyDecorator =>
  applyDecorators(IsOptional(), IsUrl({ protocols: ['http', 'https'], require_protocol: true }), MaxLength(500));
