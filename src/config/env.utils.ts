/**
 * Parsing helpers for config factories. Values are already validated by Joi, and
 * ConfigModule writes the validated values (defaults included) back to process.env as strings.
 */
export function envString(key: string): string {
  const value = process.env[key];
  if (value === undefined) {
    throw new Error(`Missing environment variable ${key}`);
  }
  return value;
}

export function envOptionalString(key: string): string | undefined {
  const value = process.env[key];
  return value === undefined || value === '' ? undefined : value;
}

export function envInt(key: string): number {
  const value = Number.parseInt(envString(key), 10);
  if (Number.isNaN(value)) {
    throw new Error(`Environment variable ${key} is not an integer`);
  }
  return value;
}

export function envBool(key: string): boolean {
  return envString(key).toLowerCase() === 'true';
}

export function envList(key: string): string[] {
  return (process.env[key] ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}
