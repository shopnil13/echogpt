import { LimitPeriod } from '../../../generated/prisma/enums';
import { quotaWindow, secondsUntil } from './quota-period';

describe('quotaWindow', () => {
  it('aligns daily windows to UTC midnight', () => {
    const window = quotaWindow(LimitPeriod.DAILY, new Date('2026-09-26T23:59:59.999Z'));
    expect(window.start.toISOString()).toBe('2026-09-26T00:00:00.000Z');
    expect(window.end.toISOString()).toBe('2026-09-27T00:00:00.000Z');
  });

  it('aligns monthly windows to the first of the month and rolls over the year', () => {
    const window = quotaWindow(LimitPeriod.MONTHLY, new Date('2026-12-15T12:00:00.000Z'));
    expect(window.start.toISOString()).toBe('2026-12-01T00:00:00.000Z');
    expect(window.end.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('never returns less than one second until reset', () => {
    const now = new Date('2026-09-26T10:00:00.000Z');
    expect(secondsUntil(new Date('2026-09-26T10:00:30.200Z'), now)).toBe(31);
    expect(secondsUntil(new Date('2026-09-26T09:00:00.000Z'), now)).toBe(1);
  });
});
