/**
 * Design tokens synced from the gustafta-pkb web artifact (src/index.css).
 * Primary: hsl(207 90% 40%), Accent: hsl(171 72% 38%), Radius: 0.75rem → 12px
 */

const colors = {
  light: {
    text: '#141D2B',
    tint: '#0B70C1',
    background: '#F5F7FA',
    foreground: '#141D2B',
    card: '#FFFFFF',
    cardForeground: '#141D2B',
    primary: '#0B70C1',
    primaryForeground: '#FFFFFF',
    secondary: '#E0EDF8',
    secondaryForeground: '#141D2B',
    muted: '#EDF0F6',
    mutedForeground: '#6B7488',
    accent: '#1AA890',
    accentForeground: '#FFFFFF',
    destructive: '#EF3B2C',
    destructiveForeground: '#FFFFFF',
    border: '#D8DCE8',
    input: '#D8DCE8',
    ring: '#0B70C1',
  },
  dark: {
    text: '#E8EDF6',
    tint: '#3B91E0',
    background: '#0D1525',
    foreground: '#E8EDF6',
    card: '#172035',
    cardForeground: '#E8EDF6',
    primary: '#3B91E0',
    primaryForeground: '#FFFFFF',
    secondary: '#1E2E45',
    secondaryForeground: '#E8EDF6',
    muted: '#172035',
    mutedForeground: '#8B96AA',
    accent: '#1AA890',
    accentForeground: '#FFFFFF',
    destructive: '#EF3B2C',
    destructiveForeground: '#FFFFFF',
    border: '#253348',
    input: '#253348',
    ring: '#3B91E0',
  },
  // 0.75rem = 12px — matches web --radius token
  radius: 12,
};

export default colors;
