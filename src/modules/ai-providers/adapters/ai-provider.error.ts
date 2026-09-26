import { HttpStatus } from '@nestjs/common';

import { AppException } from '../../../common/errors/app.exception';
import { ErrorCode } from '../../../common/errors/error-codes';

export type ProviderFailure =
  'AUTH' | 'RATE_LIMITED' | 'TIMEOUT' | 'UNAVAILABLE' | 'REFUSED' | 'ABORTED';

const FAILURES: Record<
  Exclude<ProviderFailure, 'ABORTED'>,
  { status: HttpStatus; code: ErrorCode; message: string }
> = {
  AUTH: {
    status: HttpStatus.BAD_GATEWAY,
    code: ErrorCode.PROVIDER_AUTH_FAILED,
    message: 'The AI provider rejected its configured credentials',
  },
  RATE_LIMITED: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    code: ErrorCode.PROVIDER_RATE_LIMITED,
    message: 'The AI provider is rate limiting requests; try again shortly',
  },
  TIMEOUT: {
    status: HttpStatus.GATEWAY_TIMEOUT,
    code: ErrorCode.PROVIDER_TIMEOUT,
    message: 'The AI provider did not respond in time',
  },
  UNAVAILABLE: {
    status: HttpStatus.BAD_GATEWAY,
    code: ErrorCode.PROVIDER_UNAVAILABLE,
    message: 'The AI provider failed to process the request',
  },
  REFUSED: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    code: ErrorCode.PROVIDER_REFUSED,
    message: 'The AI model declined to answer this request',
  },
};

/**
 * Normalized provider failure. The public message is generic; `detail` keeps the upstream
 * reason for logs and admin health checks but is never sent to end users.
 */
export class AiProviderError extends AppException {
  readonly failure: ProviderFailure;
  readonly detail: string;

  constructor(failure: ProviderFailure, detail: string, cause?: unknown) {
    const spec =
      failure === 'ABORTED'
        ? {
            status: 499 as HttpStatus,
            code: 'PROVIDER_ABORTED',
            message: 'The request was cancelled',
          }
        : FAILURES[failure];
    super(spec.status, spec.code, spec.message, { cause });
    this.failure = failure;
    this.detail = detail.slice(0, 500);
  }
}

/** Status-code based classification shared by adapters whose SDK errors expose `status`. */
export function classifyHttpStatus(status: number | undefined): ProviderFailure {
  if (status === 401 || status === 403) return 'AUTH';
  if (status === 429 || status === 529) return 'RATE_LIMITED';
  if (status === 408 || status === 504) return 'TIMEOUT';
  return 'UNAVAILABLE';
}
