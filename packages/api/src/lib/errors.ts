export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Invalid or missing API key') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(403, 'FORBIDDEN', message);
  }
}

export class PermissionError extends ForbiddenError {
  constructor(public requiredPermission: string) {
    super(`API key requires the ${requiredPermission} permission`);
    this.name = 'PermissionError';
  }
}

export class ToolApprovalError extends AppError {
  constructor(
    public approvalRequirement: string,
    public manifestDigest: string | null,
    public reasons: string[],
    message = 'Explicit approval is required for this tool version',
  ) {
    super(403, 'TOOL_APPROVAL_REQUIRED', message);
    this.name = 'ToolApprovalError';
  }
}

export class ToolPolicyBlockedError extends AppError {
  constructor(public reasons: string[]) {
    super(403, 'TOOL_POLICY_BLOCKED', 'This tool is not currently eligible for calls');
    this.name = 'ToolPolicyBlockedError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, 'NOT_FOUND', `${resource} not found`);
  }
}

export class InsufficientFundsError extends AppError {
  constructor(message = 'Insufficient wallet balance') {
    super(402, 'INSUFFICIENT_FUNDS', message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, 'CONFLICT', message);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, 'VALIDATION_ERROR', message);
  }
}

export class SpendLimitError extends AppError {
  constructor(message: string) {
    super(403, 'SPEND_LIMIT_EXCEEDED', message);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string, public retryAfterSeconds = 60) {
    super(429, 'RATE_LIMIT_EXCEEDED', message);
  }
}
