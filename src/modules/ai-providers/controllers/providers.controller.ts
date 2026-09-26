import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ApiErrorResponses } from '../../../common/decorators/api-error-responses.decorator';
import { ACCESS_TOKEN_SECURITY } from '../../../infrastructure/swagger/swagger.setup';
import { ProviderResponseDto } from '../dto/responses/provider.response.dto';
import { toProviderResponse } from '../mappers/provider.mapper';
import { AiProvidersService } from '../services/ai-providers.service';

@ApiTags('AI providers')
@ApiBearerAuth(ACCESS_TOKEN_SECURITY)
@Controller('providers')
export class ProvidersController {
  constructor(private readonly service: AiProvidersService) {}

  @Get()
  @ApiOperation({
    summary: 'List selectable AI providers',
    description:
      'Enabled providers and their enabled models, default first. Use the id and a model name in chat requests.',
  })
  @ApiOkResponse({ type: ProviderResponseDto, isArray: true })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED)
  async list(): Promise<ProviderResponseDto[]> {
    return (await this.service.listSelectable()).map(toProviderResponse);
  }
}
