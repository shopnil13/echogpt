import { LimitPeriod } from '../../../generated/prisma/enums';

export interface QuotaWindow {
  start: Date;
  end: Date;
}

/** Quota windows are calendar-aligned in UTC: [00:00 today, 00:00 tomorrow) or [1st, next 1st). */
export function quotaWindow(period: LimitPeriod, now: Date = new Date()): QuotaWindow {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  if (period === LimitPeriod.MONTHLY) {
    return {
      start: new Date(Date.UTC(year, month, 1)),
      end: new Date(Date.UTC(year, month + 1, 1)),
    };
  }
  const day = now.getUTCDate();
  return {
    start: new Date(Date.UTC(year, month, day)),
    end: new Date(Date.UTC(year, month, day + 1)),
  };
}

export function secondsUntil(target: Date, now: Date = new Date()): number {
  return Math.max(1, Math.ceil((target.getTime() - now.getTime()) / 1000));
}
