import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  MinLength,
  ValidateIf,
  validateSync,
} from 'class-validator';

enum NodeEnvironment {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

export class Environment {
  @IsEnum(NodeEnvironment)
  NODE_ENV: NodeEnvironment = NodeEnvironment.Development;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 4000;

  @IsUrl({ require_tld: false })
  APP_URL: string;

  @IsUrl({ protocols: ['postgres', 'postgresql'], require_tld: false })
  DATABASE_URL: string;

  @IsString()
  @MinLength(32)
  JWT_SECRET: string;

  @IsString()
  @MinLength(32)
  INTERNAL_SECRET: string;

  @IsInt()
  @Min(0)
  TRUST_PROXY_HOPS: number = 1;

  @ValidateIf((env: Environment) => env.NODE_ENV === NodeEnvironment.Production || env.SMTP_HOST !== undefined)
  @IsString()
  @IsNotEmpty()
  SMTP_HOST?: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  SMTP_PORT: number = 587;

  @IsOptional()
  @IsString()
  SMTP_USER?: string;

  @IsOptional()
  @IsString()
  SMTP_PASSWORD?: string;

  @IsString()
  @IsNotEmpty()
  MAIL_FROM: string;

  @IsString()
  @IsNotEmpty()
  UPLOAD_DIR: string = './uploads';

  @IsUrl({ require_tld: false })
  MEDIA_BASE_URL: string;

  @IsString()
  @MinLength(32)
  REVALIDATE_SECRET: string;
}

export function validateEnvironment(raw: Record<string, unknown>): Environment {
  const environment = plainToInstance(Environment, raw, { enableImplicitConversion: true });
  const errors = validateSync(environment);

  if (errors.length > 0) {
    const messages = errors.map(
      ({ property, constraints }) => `${property}: ${Object.values(constraints ?? {}).join(', ')}`,
    );
    throw new Error(`Invalid environment\n${messages.join('\n')}`);
  }

  return environment;
}
