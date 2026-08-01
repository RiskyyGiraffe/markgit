import { createHash } from 'node:crypto';
import { ValidationError } from './errors.js';

export type ToolRiskLevel = 'low' | 'medium' | 'high' | 'critical' | 'unknown';
export type ToolApprovalRequirement =
  | 'covered_by_user_policy'
  | 'first_use'
  | 'per_call'
  | 'explicit_unverified'
  | 'blocked';

export type ToolCapabilities = {
  declared: boolean;
  readOnly: boolean;
  destructive: boolean;
  idempotent: boolean;
  openWorld: boolean;
  readsPrivateData: boolean;
  seesUntrustedContent: boolean;
  writesExternalData: boolean;
  sendsMessages: boolean;
  spendsMoney: boolean;
  executesCode: boolean;
  requiresUserCredential: boolean;
  allowedOutboundDomains: string[];
  dataRetention: 'none' | 'transient' | 'stored' | 'unknown';
};

export type ToolPolicyDecision = {
  callable: boolean;
  monetizationEligible: boolean;
  eligibleForAutoCall: boolean;
  riskLevel: ToolRiskLevel;
  approval: {
    requirement: ToolApprovalRequirement;
    manifestDigest: string | null;
  };
  reasons: string[];
};

const booleanCapabilityFields = [
  'readOnly',
  'destructive',
  'idempotent',
  'openWorld',
  'readsPrivateData',
  'seesUntrustedContent',
  'writesExternalData',
  'sendsMessages',
  'spendsMoney',
  'executesCode',
  'requiresUserCredential',
] as const;

type CapabilityInput = Partial<Omit<ToolCapabilities, 'declared'>>;

export function normalizeToolCapabilities(
  input: unknown,
  executionConfig?: Record<string, unknown> | null,
): ToolCapabilities {
  const declarationMissing = input === undefined || input === null;
  if (!declarationMissing && (typeof input !== 'object' || Array.isArray(input))) {
    throw new ValidationError('capabilities must be an object');
  }
  const candidate = (input ?? {}) as Record<string, unknown>;
  for (const field of booleanCapabilityFields) {
    if (candidate[field] !== undefined && typeof candidate[field] !== 'boolean') {
      throw new ValidationError(`capabilities.${field} must be true or false`);
    }
  }

  const rawDomains = candidate.allowedOutboundDomains;
  if (
    rawDomains !== undefined &&
    (!Array.isArray(rawDomains) || rawDomains.some((domain) => typeof domain !== 'string'))
  ) {
    throw new ValidationError('capabilities.allowedOutboundDomains must be an array of hostnames');
  }
  const domains = new Set<string>();
  for (const rawDomain of (rawDomains ?? []) as string[]) {
    const domain = rawDomain.trim().toLowerCase();
    if (!domain || domain.length > 253 || !/^[a-z0-9.-]+$/.test(domain)) {
      throw new ValidationError(`Invalid outbound hostname: ${rawDomain}`);
    }
    domains.add(domain);
  }
  const baseUrl = executionConfig?.baseUrl;
  if (typeof baseUrl === 'string') {
    try {
      domains.add(new URL(baseUrl).hostname.toLowerCase());
    } catch {
      // URL validation is handled by the manifest/execution configuration layer.
    }
  }

  const retention = candidate.dataRetention ?? 'unknown';
  if (!['none', 'transient', 'stored', 'unknown'].includes(String(retention))) {
    throw new ValidationError('capabilities.dataRetention must be none, transient, stored, or unknown');
  }

  const authMode = (executionConfig?.auth as { mode?: string } | undefined)?.mode;
  const provided = declarationMissing ? undefined : input as CapabilityInput;
  return {
    declared: !declarationMissing,
    readOnly: provided?.readOnly ?? false,
    destructive: provided?.destructive ?? false,
    idempotent: provided?.idempotent ?? false,
    openWorld: provided?.openWorld ?? true,
    readsPrivateData: provided?.readsPrivateData ?? false,
    seesUntrustedContent: provided?.seesUntrustedContent ?? true,
    writesExternalData: provided?.writesExternalData ?? false,
    sendsMessages: provided?.sendsMessages ?? false,
    spendsMoney: provided?.spendsMoney ?? false,
    executesCode: provided?.executesCode ?? false,
    requiresUserCredential: provided?.requiresUserCredential ?? (authMode === 'buyer_supplied'),
    allowedOutboundDomains: [...domains].sort(),
    dataRetention: retention as ToolCapabilities['dataRetention'],
  };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

export function digestToolManifest(manifest: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(manifest))).digest('hex');
}

export function endpointMatchesVerifiedOrigin(
  executionConfig: Record<string, unknown> | null,
  verifiedOrigins: string | null | readonly string[],
): boolean {
  if (!verifiedOrigins || typeof executionConfig?.baseUrl !== 'string') return false;
  try {
    const endpointOrigin = new URL(executionConfig.baseUrl).origin;
    const origins = Array.isArray(verifiedOrigins) ? verifiedOrigins : [verifiedOrigins];
    return origins.some((origin) => endpointOrigin === new URL(origin).origin);
  } catch {
    return false;
  }
}

export function classifyToolRisk(capabilities: ToolCapabilities): ToolRiskLevel {
  if (!capabilities.declared) return 'unknown';
  if (capabilities.executesCode || capabilities.spendsMoney || capabilities.destructive) return 'critical';
  if (
    capabilities.sendsMessages ||
    capabilities.writesExternalData ||
    capabilities.readsPrivateData ||
    capabilities.requiresUserCredential ||
    capabilities.dataRetention === 'stored'
  ) return 'high';
  if (
    capabilities.openWorld ||
    capabilities.seesUntrustedContent ||
    !capabilities.readOnly ||
    capabilities.dataRetention === 'unknown'
  ) return 'medium';
  return 'low';
}

export function computeToolPolicy(input: {
  productStatus: string;
  moderationStatus: string;
  pricePerCallUsd: string;
  manifestDigest: string | null;
  capabilities: ToolCapabilities;
  endpointVerified: boolean;
  paymentVerified: boolean;
}): ToolPolicyDecision {
  const riskLevel = classifyToolRisk(input.capabilities);
  const isPaid = Number.parseFloat(input.pricePerCallUsd) > 0;
  const monetizationEligible = !isPaid || (input.endpointVerified && input.paymentVerified);
  const reasons: string[] = [];

  if (input.productStatus !== 'active') reasons.push(`tool status is ${input.productStatus}`);
  if (input.moderationStatus === 'quarantined') reasons.push('tool is quarantined');
  if (input.moderationStatus === 'flagged') reasons.push('tool is under review');
  if (!input.manifestDigest) reasons.push('tool does not yet have an immutable version');
  if (!input.endpointVerified) reasons.push('endpoint origin is not verified');
  if (!input.capabilities.declared) reasons.push('capabilities have not been declared');
  if (isPaid && !input.paymentVerified) reasons.push('paid provider has not completed payment verification');
  if (isPaid && !input.endpointVerified) reasons.push('paid endpoint must be verified');

  const blocked =
    input.productStatus !== 'active' ||
    input.moderationStatus === 'quarantined' ||
    !monetizationEligible;
  if (blocked) {
    return {
      callable: false,
      monetizationEligible,
      eligibleForAutoCall: false,
      riskLevel,
      approval: { requirement: 'blocked', manifestDigest: input.manifestDigest },
      reasons,
    };
  }

  let requirement: ToolApprovalRequirement;
  if (!input.endpointVerified || !input.manifestDigest || riskLevel === 'unknown') {
    requirement = 'explicit_unverified';
  } else if (riskLevel === 'critical' || riskLevel === 'high') {
    requirement = 'per_call';
    reasons.push(`${riskLevel}-risk capabilities require approval for every call`);
  } else if (riskLevel === 'medium' || input.moderationStatus === 'flagged') {
    requirement = 'first_use';
    reasons.push('tool requires an initial trust approval');
  } else {
    requirement = 'covered_by_user_policy';
    reasons.push('verified low-risk tool may use standing user policy');
  }

  return {
    callable: true,
    monetizationEligible,
    eligibleForAutoCall: requirement === 'covered_by_user_policy',
    riskLevel,
    approval: { requirement, manifestDigest: input.manifestDigest },
    reasons,
  };
}
