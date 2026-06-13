import { getModuleSetting, setModuleSetting } from '../module-settings';

/**
 * Locale configuration for the multi-language layer. Stored in module_settings
 * under 'i18n.config'. The default locale is never machine-translated (it's the
 * source language).
 */

const KEY = 'i18n.config';

export interface Locale {
  code: string; // BCP-47-ish, e.g. 'en', 'fr', 'he'
  label: string;
  enabled: boolean;
}

export interface I18nConfig {
  defaultLocale: string;
  locales: Locale[];
  /** When true, public translate calls may hit the provider on a cache miss. */
  autoTranslate: boolean;
}

export const DEFAULT_I18N_CONFIG: I18nConfig = {
  defaultLocale: 'en',
  locales: [{ code: 'en', label: 'English', enabled: true }],
  autoTranslate: false,
};

export async function getI18nConfig(): Promise<I18nConfig> {
  const cfg = await getModuleSetting<I18nConfig>(KEY, DEFAULT_I18N_CONFIG);
  return {
    defaultLocale: cfg.defaultLocale || 'en',
    locales: Array.isArray(cfg.locales) && cfg.locales.length ? cfg.locales : DEFAULT_I18N_CONFIG.locales,
    autoTranslate: !!cfg.autoTranslate,
  };
}

export async function setI18nConfig(config: I18nConfig): Promise<void> {
  await setModuleSetting(KEY, {
    defaultLocale: config.defaultLocale || 'en',
    locales: (config.locales || []).map((l) => ({
      code: String(l.code).trim(),
      label: String(l.label || l.code).trim(),
      enabled: l.enabled !== false,
    })),
    autoTranslate: !!config.autoTranslate,
  });
}

export async function listEnabledLocales(): Promise<Locale[]> {
  const cfg = await getI18nConfig();
  return cfg.locales.filter((l) => l.enabled);
}
