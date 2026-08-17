import { parseYmd, formatYmd } from '../lib/apl-dates';

describe('APL edit date helpers', () => {
  it('parses a valid YYYY-MM-DD as a local date', () => {
    const d = parseYmd('1990-01-31');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(1990);
    expect(d!.getMonth()).toBe(0);
    expect(d!.getDate()).toBe(31);
  });

  it('rejects empty and malformed input', () => {
    expect(parseYmd('')).toBeNull();
    expect(parseYmd('31-01-1990')).toBeNull();
    expect(parseYmd('1990/01/31')).toBeNull();
    expect(parseYmd('abcd-ef-gh')).toBeNull();
  });

  it('formats a Date back to YYYY-MM-DD with zero padding', () => {
    expect(formatYmd(new Date(2027, 11, 31))).toBe('2027-12-31');
    expect(formatYmd(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('round-trips every date component (year, month, day changes)', () => {
    for (const s of ['1940-02-29', '1999-12-01', '2027-06-15']) {
      const d = parseYmd(s);
      expect(d).not.toBeNull();
      expect(formatYmd(d!)).toBe(s);
    }
  });
});
