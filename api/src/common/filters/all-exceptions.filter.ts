import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { hasErrorExtras } from '../exceptions/error-extras.js';

const ERROR_CODES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_ERROR',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHENTICATED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'FILE_TOO_LARGE',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'UNSUPPORTED_MEDIA_TYPE',
  [HttpStatus.LOCKED]: 'ACCOUNT_LOCKED',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
};
const INTERNAL_ERROR_CODE = 'INTERNAL_ERROR';
const INTERNAL_ERROR_MESSAGE = 'Something went wrong';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const requestId = randomUUID();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const isServerError = status >= HttpStatus.INTERNAL_SERVER_ERROR;

    if (isServerError) {
      const request = host.switchToHttp().getRequest<Request>();
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(`[${requestId}] ${request.method} ${request.originalUrl}`, stack);
    }

    const code = isServerError ? INTERNAL_ERROR_CODE : (ERROR_CODES[status] ?? INTERNAL_ERROR_CODE);
    const message = isServerError || !(exception instanceof HttpException) ? INTERNAL_ERROR_MESSAGE : exception.message;

    response.setHeader('x-request-id', requestId);
    const extras = hasErrorExtras(exception) ? exception.extras : {};

    response.status(status).json({ error: { code, message, ...extras, requestId } });
  }
}
