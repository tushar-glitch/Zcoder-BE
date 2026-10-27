import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../config/environment.js';
import { AuditService } from '../../modules/audit/audit.service.js';

export const REVALIDATE_SECRET_HEADER = 'x-revalidate-secret';
export const RETRY_DELAYS_MS = [500, 1500];
const REQUEST_TIMEOUT_MS = 5000;

const sleep = (milliseconds: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, milliseconds));

@Injectable()
export class RevalidationService {
  private readonly logger = new Logger(RevalidationService.name);
  private readonly endpoint: string;
  private readonly secret: string;

  constructor(
    config: ConfigService<Environment, true>,
    private readonly audit: AuditService,
  ) {
    this.endpoint = new URL('/api/revalidate', config.get('APP_URL', { infer: true })).toString();
    this.secret = config.get('REVALIDATE_SECRET', { infer: true });
  }

  revalidate(tags: string[]): void {
    void this.deliverWithRetries([...new Set(tags)]);
  }

  private async deliverWithRetries(tags: string[]): Promise<void> {
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      if (await this.deliver(tags)) {
        return;
      }
      if (attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt]);
      }
    }

    this.logger.error(`Could not revalidate the site for tags: ${tags.join(', ')}`);
    await this.audit.record({ adminId: null, action: 'revalidate.failed', entityType: 'site', metadata: { tags } });
  }

  private async deliver(tags: string[]): Promise<boolean> {
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', [REVALIDATE_SECRET_HEADER]: this.secret },
        body: JSON.stringify({ tags }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
