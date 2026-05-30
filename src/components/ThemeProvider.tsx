'use client';

import { useEffect } from 'react';

type ThemeColors = {
  primary?: string;
  primaryDark?: string;
  secondary?: string;
  accent?: string;
  success?: string;
  error?: string;
  warning?: string;
  info?: string;
};

type ThemeFonts = {
  primary?: string;
  secondary?: string;
  mono?: string;
};

export type ThemePayload = {
  colors?: ThemeColors;
  fonts?: ThemeFonts;
  borderRadius?: string;
  shadowIntensity?: 'light' | 'medium' | 'heavy';
};

const SHADOW_MAP: Record<string, string> = {
  light: '0 2px 8px rgba(0, 0, 0, 0.1)',
  medium: '0 8px 24px rgba(0, 0, 0, 0.3)',
  heavy: '0 12px 40px rgba(0, 0, 0, 0.5)',
};

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
}

function applyTheme(theme: ThemePayload) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const c = theme.colors || {};
  const f = theme.fonts || {};

  if (c.primary) {
    root.style.setProperty('--color-neon-green', c.primary);
    root.style.setProperty('--color-cyber-green', c.primary);
    const rgb = hexToRgb(c.primary);
    if (rgb) {
      root.style.setProperty('--shadow-glow-green', `0 0 20px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`);
      root.style.setProperty('--shadow-card-hover', `0 12px 32px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`);
    }
  }
  if (c.primaryDark) root.style.setProperty('--color-dark', c.primaryDark);
  if (c.secondary) {
    root.style.setProperty('--color-neon-cyan', c.secondary);
    root.style.setProperty('--color-cyber-cyan', c.secondary);
  }
  if (c.accent) {
    root.style.setProperty('--color-neon-blue', c.accent);
    root.style.setProperty('--color-cyber-blue', c.accent);
  }
  if (c.success) root.style.setProperty('--color-neon-success', c.success);
  if (c.error) {
    root.style.setProperty('--color-neon-red', c.error);
    root.style.setProperty('--color-cyber-red', c.error);
  }
  if (c.warning) {
    root.style.setProperty('--color-neon-amber', c.warning);
    root.style.setProperty('--color-cyber-amber', c.warning);
  }
  if (c.info) {
    root.style.setProperty('--color-neon-purple', c.info);
    root.style.setProperty('--color-cyber-purple', c.info);
  }

  if (f.primary) root.style.setProperty('--font-sans', f.primary);
  if (f.secondary) root.style.setProperty('--font-grotesk', f.secondary);
  if (f.mono) root.style.setProperty('--font-mono', f.mono);

  if (theme.borderRadius) root.style.setProperty('--border-radius', theme.borderRadius);
  if (theme.shadowIntensity) {
    root.style.setProperty('--shadow-card', SHADOW_MAP[theme.shadowIntensity] || SHADOW_MAP.medium);
  }
}

export default function ThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme?: ThemePayload | null;
  children: React.ReactNode;
}) {
  // Apply the SSR-loaded theme synchronously on first client paint so admin
  // customizations (which can't be embedded server-side via :root CSS without
  // an inline <style>) take effect without unmounting the tree.
  useEffect(() => {
    if (initialTheme) applyTheme(initialTheme);
  }, [initialTheme]);

  return <>{children}</>;
}
