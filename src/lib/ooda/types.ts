// OODA self-improvement loop — types + policy shape.
// Layered on the existing audit automation: Observe (audit artifacts) -> Orient
// (findings -> actions) -> Decide (policy split) -> Act (auto-apply safe / propose rest).

export type RiskTier = 'safe' | 'review' | 'notify';
export type Severity = 'high' | 'medium' | 'low' | 'info';

// Safe actions touch only gitignored/generated state (reversible). The rest are
// proposed (a human reviews / the existing autofix PR flow handles them) or notify-only.
export type ActionType =
  | 'revalidate' | 'sync-seo' | 'scan-media' | 'generate-sitemap' // safe lane
  | 'content-fix' | 'ai-readiness' | 'llms-txt' | 'perf-review'    // review lane
  | 'dep-update' | 'dep-audit' | 'dep-major';                       // review/notify lane

export interface ActionItem {
  id: string;
  title: string;
  actionType: ActionType;
  severity: Severity;
  riskTier: RiskTier;
  detail: string;
  source: 'seo' | 'ai' | 'perf' | 'deps' | 'system';
}

export interface OodaPolicy {
  enabled: boolean;
  autoApply: ActionType[]; // which safe actions may run without review
  dryRun: boolean;         // propose only, don't act
}

export const DEFAULT_OODA_POLICY: OodaPolicy = {
  enabled: false,
  autoApply: ['revalidate', 'sync-seo', 'scan-media'],
  dryRun: true,
};

// The action types that are EVER eligible for the auto-apply lane. Anything else is
// review/notify regardless of policy — defense against a misconfigured allowlist.
export const SAFE_ACTION_TYPES: ActionType[] = ['revalidate', 'sync-seo', 'scan-media', 'generate-sitemap'];

export interface ActResult {
  actionType: ActionType;
  ok: boolean;
  applied: boolean; // false when dryRun or skipped
  message: string;
}

export interface OodaReport {
  ok: boolean;
  date: string | null;
  dryRun: boolean;
  message?: string;
  observed: { seo: boolean; ai: boolean; perf: boolean; deps: boolean };
  oriented: ActionItem[];
  decided: { autoApply: ActionItem[]; propose: ActionItem[]; notify: ActionItem[] };
  acted: ActResult[];
  finishedAt: string;
}
