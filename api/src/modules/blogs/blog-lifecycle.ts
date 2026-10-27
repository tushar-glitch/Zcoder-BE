import { ConflictException } from '@nestjs/common';
import { BlogStatus } from '../../generated/prisma/client.js';

export function assertCanPublish(status: BlogStatus): void {
  if (status !== BlogStatus.DRAFT) {
    throw new ConflictException('Blog is already published');
  }
}

export function assertCanUnpublish(status: BlogStatus): void {
  if (status !== BlogStatus.PUBLISHED) {
    throw new ConflictException('Only published blogs can be unpublished');
  }
}

export function assertCanDelete(status: BlogStatus): void {
  if (status !== BlogStatus.DRAFT) {
    throw new ConflictException('Unpublish the blog before deleting it');
  }
}
