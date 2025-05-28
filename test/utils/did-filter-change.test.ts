import { describe, it, expect } from 'vitest';

import { didFilterChange } from '../../src/utils/did-filter-change';

describe('didFilterChange', () => {
  it('should consider a changed filter changed', () => {
    const a = {
      debug: true,
      error: true,
      warn: true,
      info: true,
    };

    const b = {
      debug: true,
      error: true,
      warn: true,
      info: false,
    };

    expect(didFilterChange(a, b)).toBe(true);
  });

  it('should consider an unchanged filter unchanged', () => {
    const a = {
      debug: true,
      error: true,
      warn: true,
      info: true,
    };

    const b = {
      debug: true,
      error: true,
      warn: true,
      info: true,
    };

    expect(didFilterChange(a, b)).toBe(false);
  });
});
