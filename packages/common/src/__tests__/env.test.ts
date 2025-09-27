import { describe, expect, it } from 'vitest';

import { optionalEnv, requireEnv, requireEnvAlias, requireInteger } from '../env.js';

describe('env helpers', () => {
  const env = {
    FOO: 'bar',
    INT: '42',
    EMPTY: '',
  } satisfies Record<string, string | undefined>;

  it('requireEnv returns the value when set', () => {
    expect(requireEnv('FOO', env)).toBe('bar');
  });

  it('requireEnv throws when missing or empty', () => {
    expect(() => requireEnv('MISSING', env)).toThrowError(/MISSING/);
    expect(() => requireEnv('EMPTY', env)).toThrowError(/EMPTY/);
  });

  it('requireEnvAlias checks aliases when primary missing', () => {
    expect(requireEnvAlias('OTHER', { ...env, OTHER_ALIAS: 'value' }, ['OTHER_ALIAS'])).toBe('value');
    expect(() => requireEnvAlias('UNKNOWN', env, ['UNKNOWN_ALIAS'])).toThrowError(/UNKNOWN/);
  });

  it('optionalEnv returns the value or default', () => {
    expect(optionalEnv('FOO', env)).toBe('bar');
    expect(optionalEnv('MISSING', env, 'fallback')).toBe('fallback');
    expect(optionalEnv('EMPTY', env, 'fb')).toBe('fb');
  });

  it('requireInteger parses and validates integers', () => {
    expect(requireInteger('INT', env)).toBe(42);
    expect(() => requireInteger('FOO', env)).toThrowError();
    expect(() => requireInteger('INT', env, { min: 100 })).toThrowError(/>= 100/);
  });
});
