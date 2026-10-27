import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { Paginated } from '../pagination/paginated.js';

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((result) => this.wrap(result)));
  }

  private wrap(result: unknown): unknown {
    if (result === undefined) {
      return result;
    }
    return result instanceof Paginated ? { data: result.items, meta: result.meta } : { data: result };
  }
}
