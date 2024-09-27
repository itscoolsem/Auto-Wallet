/**
 * Common error classes for AutoBridge
 */

export class AutoBridgeError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AutoBridgeError';
  }
}

export class ValidationError extends AutoBridgeError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', context);
    this.name = 'ValidationError';
  }
}

export class NetworkError extends AutoBridgeError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'NETWORK_ERROR', context);
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends AutoBridgeError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'TIMEOUT_ERROR', context);
    this.name = 'TimeoutError';
  }
}

export class InsufficientBalanceError extends AutoBridgeError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'INSUFFICIENT_BALANCE', context);
    this.name = 'InsufficientBalanceError';
  }
}

export class ContractError extends AutoBridgeError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'CONTRACT_ERROR', context);
    this.name = 'ContractError';
  }
}

export function isAutoBridgeError(error: unknown): error is AutoBridgeError {
  return error instanceof AutoBridgeError;
}

export function createErrorFromCode(code: string, message: string, context?: Record<string, unknown>): AutoBridgeError {
  switch (code) {
    case 'VALIDATION_ERROR':
      return new ValidationError(message, context);
    case 'NETWORK_ERROR':
      return new NetworkError(message, context);
    case 'TIMEOUT_ERROR':
      return new TimeoutError(message, context);
    case 'INSUFFICIENT_BALANCE':
      return new InsufficientBalanceError(message, context);
    case 'CONTRACT_ERROR':
      return new ContractError(message, context);
    default:
      return new AutoBridgeError(message, code, context);
  }
}