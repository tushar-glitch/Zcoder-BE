import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../config/environment.js';
import { FileStorage } from './file-storage.js';
import { LocalFileStorage } from './local-file-storage.js';

@Global()
@Module({
  providers: [
    {
      provide: FileStorage,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Environment, true>): FileStorage =>
        new LocalFileStorage(config.get('UPLOAD_DIR', { infer: true }), config.get('MEDIA_BASE_URL', { infer: true })),
    },
  ],
  exports: [FileStorage],
})
export class StorageModule {}
