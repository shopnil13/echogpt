import { Transform } from 'class-transformer';

/** Trims string input; leaves other types for the validators to reject. */
export function Trim(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );
}

/** Trims and lower-cases string input (emails, codes). */
export function NormalizeEmail(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  );
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
