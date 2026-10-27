import { plainToInstance } from 'class-transformer';
import { IsEnum, IsInt, IsUrl, Max, Min, validateSync } from 'class-validator';

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
