import { type ApiUsageLog } from '../../../generated/prisma/client';
import { type RequestLogResponseDto } from '../dto/responses/request-log.response.dto';

export function toRequestLogResponse(log: ApiUsageLog): RequestLogResponseDto {
  return { ...log, id: log.id.toString() };
}
