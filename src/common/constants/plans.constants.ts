/** Plan codes stored in `plans.code`. Seeded by prisma/seed.ts; limits are data, tunable by admins. */
export enum PlanCode {
  FREE = 'free',
  PREMIUM = 'premium',
}

/** Plan assigned to every new account. */
export const DEFAULT_PLAN_CODE = PlanCode.FREE;
