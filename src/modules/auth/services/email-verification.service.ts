import { Inject, Injectable, Logger } from '@nestjs/common';

import { AppException } from '../../../common/errors/app.exception';
import { ErrorCode } from '../../../common/errors/error-codes';
import { authConfig, type AuthConfig } from '../../../config/auth.config';
import { VerificationPurpose } from '../../../generated/prisma/enums';
import { MailService } from '../../../infrastructure/mail/mail.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { generateOpaqueToken, sha256Hex } from '../../../infrastructure/security/opaque-tokens';
import { UsersService } from '../../users/services/users.service';
import { VerificationTokensRepository } from '../repositories/verification-tokens.repository';

interface VerificationRecipient {
  id: string;
  email: string;
  fullName: string;
}

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    private readonly tokensRepository: VerificationTokensRepository,
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
    private readonly prisma: PrismaService,
    @Inject(authConfig.KEY) private readonly config: AuthConfig,
  ) {}

  /** Issues a fresh single-use token (older ones are invalidated) and emails the link. */
  async send(recipient: VerificationRecipient): Promise<void> {
    await this.tokensRepository.invalidateOutstanding(
      recipient.id,
      VerificationPurpose.EMAIL_VERIFICATION,
    );

    const token = generateOpaqueToken();
    const ttlMs = this.config.emailVerificationTtlHours * 60 * 60 * 1000;
    await this.tokensRepository.create({
      userId: recipient.id,
      purpose: VerificationPurpose.EMAIL_VERIFICATION,
      tokenHash: sha256Hex(token),
      expiresAt: new Date(Date.now() + ttlMs),
    });

    const link = new URL(this.config.emailVerificationUrl);
    link.searchParams.set('token', token);
    await this.mailService.send({
      to: recipient.email,
      subject: 'Verify your EchoGPT email address',
      text: [
        `Hi ${recipient.fullName},`,
        '',
        'Confirm your email address by opening this link:',
        link.toString(),
        '',
        `The link expires in ${this.config.emailVerificationTtlHours} hours.`,
        'If you did not create an EchoGPT account, you can ignore this email.',
      ].join('\n'),
    });
  }

  /** Best-effort variant for flows that must not fail when mail delivery fails (registration). */
  async sendSafely(recipient: VerificationRecipient): Promise<void> {
    try {
      await this.send(recipient);
    } catch (error: unknown) {
      this.logger.error({ err: error, userId: recipient.id }, 'Failed to send verification email');
    }
  }

  async resend(userId: string): Promise<void> {
    const user = await this.usersService.getProfile(userId);
    if (user.emailVerifiedAt) {
      throw AppException.conflict(
        ErrorCode.EMAIL_ALREADY_VERIFIED,
        'Email address is already verified',
      );
    }
    await this.send(user);
  }

  async verify(token: string): Promise<void> {
    const record = await this.tokensRepository.findByHash(
      sha256Hex(token),
      VerificationPurpose.EMAIL_VERIFICATION,
    );
    if (!record || record.usedAt || record.expiresAt <= new Date()) {
      throw this.invalidToken();
    }

    await this.prisma.$transaction(async (tx) => {
      const consumed = await this.tokensRepository.consume(record.id, tx);
      if (!consumed) throw this.invalidToken();
      await this.usersService.markEmailVerified(record.userId, tx);
    });
  }

  private invalidToken(): AppException {
    return AppException.badRequest(
      ErrorCode.AUTH_VERIFICATION_TOKEN_INVALID,
      'Verification token is invalid, expired or already used',
    );
  }
}
