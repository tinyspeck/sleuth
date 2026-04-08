import { describe, it, expect } from 'vitest';
import { matchTag } from '../../src/utils/match-tag';

describe('matchTag', () => {
  it('matches webapp-style [TAG] prefixes', () => {
    const result = matchTag('[HUDDLES] joined call');
    expect(result).not.toBeNull();
    expect(result![1]).toBe('HUDDLES');
    expect(result![0]).toBe('[HUDDLES]');
  });

  it('matches browser-style Tag: prefixes', () => {
    const result = matchTag('Store: UPDATE_SETTINGS');
    expect(result).not.toBeNull();
    expect(result![1]).toBe('Store');
    expect(result![0]).toBe('Store:');
  });

  it('matches epic-style Tag = name; prefixes', () => {
    const result = matchTag('Tag = fooBarEpic; rest');
    expect(result).not.toBeNull();
    expect(result![1]).toBe('fooBarEpic');
    expect(result![0]).toBe('Tag = fooBarEpic;');
  });

  it('handles leading whitespace', () => {
    const result = matchTag('  [SPACED TAG] msg');
    expect(result).not.toBeNull();
    expect(result![1]).toBe('SPACED TAG');
    expect(result![0]).toBe('  [SPACED TAG]');
  });

  it('matches browser prefix with bracketed sub-tag', () => {
    const result = matchTag('Store [sub-tag]: msg');
    expect(result).not.toBeNull();
    expect(result![1]).toBe('Store [sub-tag]');
    expect(result![0]).toBe('Store [sub-tag]:');
  });

  it('returns null for messages without tags', () => {
    expect(matchTag('no tag here')).toBeNull();
  });

  it('returns null for empty strings', () => {
    expect(matchTag('')).toBeNull();
  });
});
