import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';

export interface HealthStatus {
  status: 'ok';
  db: 'up';
  uptimeSeconds: number;
}

@Injectable()
export class HealthService {
  constructor(private readonly database: PrismaService) {}

  async check(): Promise<HealthStatus> {
    if (!(await this.database.isReachable())) {
      throw new ServiceUnavailableException();
    }
    return { status: 'ok', db: 'up', uptimeSeconds: Math.floor(process.uptime()) };
  }
}
