import { z } from 'zod';

export type EnvSource = NodeJS.ProcessEnv | Record<string, string | undefined>;

const nonEmptyString = z.string().min(1, 'value must be non-empty');

export function requireEnv(name: string, env: EnvSource = process.env): string {
  const value = env?.[name];
  const parsed = nonEmptyString.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Environment variable ${name} is required: ${parsed.error.issues[0]?.message ?? 'missing'}`);
  }
  return parsed.data;
}

export function requireEnvAlias(
  name: string,
  env: EnvSource = process.env,
  aliases: string[] = [],
): string {
  const candidates = [name, ...aliases];
  for (const candidate of candidates) {
    const value = env?.[candidate];
    const parsed = nonEmptyString.safeParse(value);
    if (parsed.success) {
      return parsed.data;
    }
  }

  const aliasNote = aliases.length > 0 ? ` (aliases checked: ${aliases.join(', ')})` : '';
  throw new Error(`Environment variable ${name} is required${aliasNote}`);
}

export function optionalEnv(
  name: string,
  env: EnvSource = process.env,
  defaultValue?: string,
): string | undefined {
  const value = env?.[name];
  if (value == null || value === '') {
    return defaultValue;
  }
  return value;
}

export function requireInteger(
  name: string,
  env: EnvSource = process.env,
  options: { min?: number; max?: number } = {},
): number {
  const raw = requireEnv(name, env);
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) {
    throw new Error(`Environment variable ${name} must be an integer`);
  }
  if (options.min != null && parsed < options.min) {
    throw new Error(`Environment variable ${name} must be >= ${options.min}`);
  }
  if (options.max != null && parsed > options.max) {
    throw new Error(`Environment variable ${name} must be <= ${options.max}`);
  }
  return parsed;
}
