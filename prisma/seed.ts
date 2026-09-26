/**
 * Idempotent seed: safe to run any number of times. Existing rows are never overwritten,
 * so values tuned by admins (plan limits, provider settings, passwords) survive re-seeding.
 *
 * Run with: npm run db:seed
 */
import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';

import { PlanCode } from '../src/common/constants/plans.constants';
import { RoleName } from '../src/common/constants/roles.constants';
import { LimitPeriod, PrismaClient, ProviderType } from '../src/generated/prisma/client';
import { hashPassword } from '../src/infrastructure/security/password-hashing';

const MIN_ADMIN_PASSWORD_LENGTH = 12;

const ROLES = [
  { name: RoleName.ADMIN, description: 'Full access to administration endpoints' },
  { name: RoleName.USER, description: 'Standard end user' },
];

const PLANS = [
  {
    code: PlanCode.FREE,
    name: 'Free',
    description: 'Try EchoGPT with a daily allowance',
    priceCents: 0,
    requestLimit: 20,
    limitPeriod: LimitPeriod.DAILY,
  },
  {
    code: PlanCode.PREMIUM,
    name: 'Premium',
    description: 'Higher daily allowance for power users',
    priceCents: 999,
    requestLimit: 500,
    limitPeriod: LimitPeriod.DAILY,
  },
];

/** Real providers start disabled: an admin must add an API key before enabling them. */
interface ProviderSeed {
  name: string;
  type: ProviderType;
  defaultModel: string;
  models: Array<{ name: string; displayName: string }>;
}

const PROVIDERS: ProviderSeed[] = [
  {
    name: 'OpenAI',
    type: ProviderType.OPENAI,
    defaultModel: 'gpt-5-mini',
    models: [
      { name: 'gpt-5-mini', displayName: 'GPT-5 mini' },
      { name: 'gpt-5', displayName: 'GPT-5' },
    ],
  },
  {
    name: 'Anthropic Claude',
    type: ProviderType.ANTHROPIC,
    defaultModel: 'claude-sonnet-5',
    models: [
      { name: 'claude-sonnet-5', displayName: 'Claude Sonnet 5' },
      { name: 'claude-opus-5-5', displayName: 'Claude Opus 5.5' },
      { name: 'claude-haiku-4-5-20251001', displayName: 'Claude Haiku 4.5' },
    ],
  },
  {
    name: 'Google Gemini',
    type: ProviderType.GEMINI,
    defaultModel: 'gemini-2.5-flash',
    models: [
      { name: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' },
      { name: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro' },
    ],
  },
];

const MOCK_PROVIDER: ProviderSeed = {
  name: 'Mock (development)',
  type: ProviderType.MOCK,
  defaultModel: 'mock-echo',
  models: [{ name: 'mock-echo', displayName: 'Mock echo model' }],
};

function log(message: string): void {
  process.stdout.write(`[seed] ${message}\n`);
}

function requireEnv(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) throw new Error(`Missing required environment variable ${key}`);
  return value;
}

async function seedRoles(prisma: PrismaClient): Promise<void> {
  for (const role of ROLES) {
    await prisma.role.upsert({ where: { name: role.name }, create: role, update: {} });
  }
  log(`roles: ${ROLES.map((role) => role.name).join(', ')}`);
}

async function seedPlans(prisma: PrismaClient): Promise<void> {
  for (const plan of PLANS) {
    await prisma.plan.upsert({ where: { code: plan.code }, create: plan, update: {} });
  }
  log(`plans: ${PLANS.map((plan) => plan.code).join(', ')}`);
}

async function seedAdmin(prisma: PrismaClient): Promise<void> {
  const email = requireEnv('SEED_ADMIN_EMAIL').toLowerCase();
  const password = requireEnv('SEED_ADMIN_PASSWORD');
  if (password.length < MIN_ADMIN_PASSWORD_LENGTH) {
    throw new Error(`SEED_ADMIN_PASSWORD must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters`);
  }

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    log(`admin ${email} already exists (left unchanged)`);
    return;
  }

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: RoleName.ADMIN } });
  const premium = await prisma.plan.findUniqueOrThrow({ where: { code: PlanCode.PREMIUM } });
  await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      fullName: process.env.SEED_ADMIN_NAME?.trim() || 'EchoGPT Admin',
      roleId: adminRole.id,
      emailVerifiedAt: new Date(),
      subscriptions: { create: { planId: premium.id } },
    },
  });
  log(`admin ${email} created with the premium plan`);
}

async function seedProvider(
  prisma: PrismaClient,
  provider: ProviderSeed,
  flags: { isEnabled: boolean; isDefault: boolean },
): Promise<void> {
  const existing = await prisma.aiProvider.findUnique({ where: { name: provider.name } });
  if (existing) return;
  await prisma.aiProvider.create({
    data: {
      name: provider.name,
      type: provider.type,
      defaultModel: provider.defaultModel,
      ...flags,
      models: { create: provider.models },
    },
  });
  log(`provider ${provider.name} created (enabled=${flags.isEnabled}, default=${flags.isDefault})`);
}

async function seedProviders(prisma: PrismaClient): Promise<void> {
  for (const provider of PROVIDERS) {
    await seedProvider(prisma, provider, { isEnabled: false, isDefault: false });
  }

  if (process.env.AI_MOCK_PROVIDER_ENABLED === 'true') {
    const hasDefault = (await prisma.aiProvider.count({ where: { isDefault: true } })) > 0;
    await seedProvider(prisma, MOCK_PROVIDER, { isEnabled: true, isDefault: !hasDefault });
  }
}

async function main(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: requireEnv('DATABASE_URL') }),
  });
  try {
    await seedRoles(prisma);
    await seedPlans(prisma);
    await seedAdmin(prisma);
    await seedProviders(prisma);
    log('done');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `[seed] failed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
