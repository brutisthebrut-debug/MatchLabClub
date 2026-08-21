export const COMMERCIAL_PLAN_KEYS = [
  "member",
  "insight",
  "match",
  "guided",
] as const;

export type CommercialPlanKey = (typeof COMMERCIAL_PLAN_KEYS)[number];

export interface CommercialPlan {
  key: CommercialPlanKey;
  label: string;
  outcome: string;
  prices: Array<{
    cadence: "free" | "monthly" | "annual" | "quarterly";
    amountCents: number;
  }>;
  monthlyRangeCents: { min: number; max: number } | null;
  includes: string[];
  upgradeCta: string | null;
  nextPlanKey: CommercialPlanKey | null;
  entitlements: {
    fullMirror: boolean;
    expandedPlay: boolean;
    selectedSources: boolean;
    activeMatching: boolean;
    humanGuidance: boolean;
  };
}

export const COMMERCIAL_PLANS: readonly CommercialPlan[] = [
  {
    key: "member",
    label: "Member",
    outcome: "Start building a profile that reflects the real me.",
    prices: [{ cadence: "free", amountCents: 0 }],
    monthlyRangeCents: null,
    includes: [
      "Core onboarding and profile",
      "Limited Echo",
      "Verification choice",
      "Candidate-pool opt-in",
      "Rotating Play",
      "First Mirror preview",
      "Basic Journey",
    ],
    upgradeCta: "See your full Mirror",
    nextPlanKey: "insight",
    entitlements: {
      fullMirror: false,
      expandedPlay: false,
      selectedSources: false,
      activeMatching: false,
      humanGuidance: false,
    },
  },
  {
    key: "insight",
    label: "Insight",
    outcome: "Help me understand how I date and what I actually need.",
    prices: [
      { cadence: "monthly", amountCents: 1499 },
      { cadence: "annual", amountCents: 9900 },
    ],
    monthlyRangeCents: null,
    includes: [
      "Full living Mirror",
      "Pattern and Journey insights",
      "Deeper Echo",
      "Expanded Play",
      "Selected low-cost and manual sources",
    ],
    upgradeCta: "Turn on active matching",
    nextPlanKey: "match",
    entitlements: {
      fullMirror: true,
      expandedPlay: true,
      selectedSources: true,
      activeMatching: false,
      humanGuidance: false,
    },
  },
  {
    key: "match",
    label: "Match",
    outcome: "Actively find and help me evaluate compatible people.",
    prices: [
      { cadence: "monthly", amountCents: 4900 },
      { cadence: "quarterly", amountCents: 12900 },
    ],
    monthlyRangeCents: null,
    includes: [
      "Everything in Insight",
      "Active search",
      "Limited introductions",
      "Compatibility explanations",
      "Preparation, safety, and debrief",
      "Matching refinement",
    ],
    upgradeCta: "Work through this with a coach",
    nextPlanKey: "guided",
    entitlements: {
      fullMirror: true,
      expandedPlay: true,
      selectedSources: true,
      activeMatching: true,
      humanGuidance: false,
    },
  },
  {
    key: "guided",
    label: "Guided",
    outcome:
      "Give me a real person who knows my history and helps me through this.",
    prices: [],
    monthlyRangeCents: { min: 24900, max: 49900 },
    includes: [
      "Capped human coaching",
      "Profile and match review",
      "Scheduled sessions",
      "Bounded asynchronous support",
      "Attachable to Insight or Match",
    ],
    upgradeCta: null,
    nextPlanKey: null,
    entitlements: {
      fullMirror: true,
      expandedPlay: true,
      selectedSources: true,
      activeMatching: true,
      humanGuidance: true,
    },
  },
] as const;

const PLAN_BY_KEY = new Map(COMMERCIAL_PLANS.map((plan) => [plan.key, plan]));

const LEGACY_PLAN_MAP: Readonly<Record<string, CommercialPlanKey>> = {
  free: "member",
  reset: "insight",
  wingman: "guided",
};

export type PlanAssignmentSource = "default" | "canonical" | "legacy";

export interface ResolvedCommercialPlan {
  plan: CommercialPlan;
  source: PlanAssignmentSource;
  legacyTier: string | null;
}

export function resolveCommercialPlan(
  storedTier: string | null | undefined,
): ResolvedCommercialPlan {
  const raw = storedTier?.trim().toLowerCase() ?? "";
  const canonical = PLAN_BY_KEY.get(raw as CommercialPlanKey);
  if (canonical) {
    return { plan: canonical, source: "canonical", legacyTier: null };
  }
  const migratedKey = LEGACY_PLAN_MAP[raw];
  if (migratedKey) {
    return {
      plan: PLAN_BY_KEY.get(migratedKey)!,
      source: "legacy",
      legacyTier: raw,
    };
  }
  return {
    plan: PLAN_BY_KEY.get("member")!,
    source: "default",
    legacyTier: null,
  };
}

export function normalizePlanGrant(value: unknown): CommercialPlanKey | null {
  if (value === null || value === "") return null;
  const raw = String(value).trim().toLowerCase();
  const canonical = PLAN_BY_KEY.get(raw as CommercialPlanKey);
  if (canonical) return canonical.key;
  return LEGACY_PLAN_MAP[raw] ?? null;
}

export function serializePlanAssignment(
  storedTier: string | null | undefined,
  grantedAt?: Date | string | null,
) {
  const resolved = resolveCommercialPlan(storedTier);
  const { plan } = resolved;
  return {
    key: plan.key,
    label: plan.label,
    source: resolved.source,
    grantedAt:
      grantedAt instanceof Date
        ? grantedAt.toISOString()
        : grantedAt
          ? String(grantedAt)
          : null,
    canActivateSearch: plan.entitlements.activeMatching,
    includesHumanGuidance: plan.entitlements.humanGuidance,
    nextPlanKey: plan.nextPlanKey,
    upgradeCta: plan.upgradeCta,
  };
}

export const PAID_PLAN_KEYS: readonly CommercialPlanKey[] = [
  "insight",
  "match",
  "guided",
];

export const PAID_STORED_TIER_VALUES = [
  ...PAID_PLAN_KEYS,
  "reset",
  "wingman",
] as const;
