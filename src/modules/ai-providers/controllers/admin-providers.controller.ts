import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { RoleName } from '../../../common/constants/roles.constants';
import { ApiErrorResponses } from '../../../common/decorators/api-error-responses.decorator';
import { Roles } from '../../../common/decorators/auth.decorators';
import { ErrorCode } from '../../../common/errors/error-codes';
import { ACCESS_TOKEN_SECURITY } from '../../../infrastructure/swagger/swagger.setup';
import { CreateProviderDto } from '../dto/create-provider.dto';
import { AdminProviderResponseDto } from '../dto/responses/admin-provider.response.dto';
import { HealthCheckResponseDto } from '../dto/responses/health-check.response.dto';
import { UpdateProviderStatusDto } from '../dto/update-provider-status.dto';
import { UpdateProviderDto } from '../dto/update-provider.dto';
import { toAdminProviderResponse } from '../mappers/provider.mapper';
import { AiProvidersAdminService } from '../services/ai-providers-admin.service';

const NOT_FOUND = {
  status: HttpStatus.NOT_FOUND,
  code: ErrorCode.PROVIDER_NOT_FOUND,
  message: 'AI provider not found',
};

@ApiTags('Admin · AI providers')
@ApiBearerAuth(ACCESS_TOKEN_SECURITY)
@Roles(RoleName.ADMIN)
@ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
@Controller('admin/providers')
export class AdminProvidersController {
  constructor(private readonly service: AiProvidersAdminService) {}

  @Get()
  @ApiOperation({
    summary: 'List AI providers',
    description: 'Includes disabled providers and health. Keys are never returned.',
  })
  @ApiOkResponse({ type: AdminProviderResponseDto, isArray: true })
  async list(): Promise<AdminProviderResponseDto[]> {
    return (await this.service.list()).map(toAdminProviderResponse);
  }

  @Post()
  @ApiOperation({
    summary: 'Add an AI provider',
    description: 'The API key is encrypted with AES-256-GCM before storage and is write-only.',
  })
  @ApiCreatedResponse({ type: AdminProviderResponseDto })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    {
      status: HttpStatus.CONFLICT,
      code: ErrorCode.PROVIDER_NAME_TAKEN,
      message: 'A provider named "OpenAI" already exists',
    },
    {
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      code: ErrorCode.PROVIDER_MODEL_NOT_ALLOWED,
      message: 'defaultModel must be one of the enabled models',
      description:
        'PROVIDER_MODEL_NOT_ALLOWED, PROVIDER_API_KEY_REQUIRED, PROVIDER_TYPE_UNAVAILABLE or PROVIDER_BASE_URL_NOT_ALLOWED',
    },
  )
  async create(@Body() dto: CreateProviderDto): Promise<AdminProviderResponseDto> {
    return toAdminProviderResponse(await this.service.create(dto));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an AI provider' })
  @ApiOkResponse({ type: AdminProviderResponseDto })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, NOT_FOUND)
  async get(@Param('id', new ParseUUIDPipe()) id: string): Promise<AdminProviderResponseDto> {
    return toAdminProviderResponse(await this.service.get(id));
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Edit an AI provider or rotate its API key',
    description:
      'Only provided fields change. Sending `models` replaces the whole model list. A new key resets health to UNKNOWN.',
  })
  @ApiOkResponse({ type: AdminProviderResponseDto })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    NOT_FOUND,
    {
      status: HttpStatus.CONFLICT,
      code: ErrorCode.PROVIDER_NAME_TAKEN,
      message: 'A provider named "OpenAI" already exists',
    },
    {
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      code: ErrorCode.PROVIDER_MODEL_NOT_ALLOWED,
      message: 'defaultModel must be one of the enabled models',
    },
  )
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProviderDto,
  ): Promise<AdminProviderResponseDto> {
    return toAdminProviderResponse(await this.service.update(id, dto));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete an AI provider',
    description:
      'Not allowed for the default provider. Chat history keeps its messages; their provider link becomes null.',
  })
  @ApiNoContentResponse({ description: 'Provider deleted' })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, NOT_FOUND, {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    code: ErrorCode.PROVIDER_IS_DEFAULT,
    message: 'Choose another default provider before deleting this one',
  })
  remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    return this.service.remove(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Enable or disable an AI provider' })
  @ApiOkResponse({ type: AdminProviderResponseDto })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, NOT_FOUND, {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    code: ErrorCode.PROVIDER_API_KEY_REQUIRED,
    message: 'Add an API key before enabling this provider',
    description:
      'PROVIDER_API_KEY_REQUIRED, PROVIDER_IS_DEFAULT (disabling the default) or PROVIDER_TYPE_UNAVAILABLE',
  })
  async setStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProviderStatusDto,
  ): Promise<AdminProviderResponseDto> {
    return toAdminProviderResponse(await this.service.setEnabled(id, dto.isEnabled));
  }

  @Put(':id/default')
  @ApiOperation({
    summary: 'Make this the default AI provider',
    description: 'The previous default is unset atomically.',
  })
  @ApiOkResponse({ type: AdminProviderResponseDto })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, NOT_FOUND, {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    code: ErrorCode.PROVIDER_DISABLED,
    message: 'Only an enabled provider can be the default',
  })
  async makeDefault(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<AdminProviderResponseDto> {
    return toAdminProviderResponse(await this.service.makeDefault(id));
  }

  @Post(':id/health-check')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Run a live health check',
    description:
      'Makes a cheap authenticated call (model lookup, no token spend) and stores the result. ' +
      'An unhealthy provider returns 200 with status UNHEALTHY and a sanitized error.',
  })
  @ApiOkResponse({ type: HealthCheckResponseDto })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, NOT_FOUND)
  checkHealth(@Param('id', new ParseUUIDPipe()) id: string): Promise<HealthCheckResponseDto> {
    return this.service.checkHealth(id);
  }
}
