/**
 * Common validation utilities
 */

import { isValidAddress } from './utils.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateAddress(address: string, fieldName = 'address'): ValidationResult {
  const errors: string[] = [];

  if (!address) {
    errors.push(`${fieldName} is required`);
  } else if (!isValidAddress(address)) {
    errors.push(`${fieldName} must be a valid Ethereum address`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateAmount(amount: string, fieldName = 'amount'): ValidationResult {
  const errors: string[] = [];

  if (!amount) {
    errors.push(`${fieldName} is required`);
  } else {
    const num = parseFloat(amount);
    if (isNaN(num)) {
      errors.push(`${fieldName} must be a valid number`);
    } else if (num <= 0) {
      errors.push(`${fieldName} must be positive`);
    } else if (num > Number.MAX_SAFE_INTEGER) {
      errors.push(`${fieldName} is too large`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateChainSlug(chainSlug: string, fieldName = 'chainSlug'): ValidationResult {
  const errors: string[] = [];

  if (!chainSlug) {
    errors.push(`${fieldName} is required`);
  } else if (!/^[a-z0-9-]+$/.test(chainSlug)) {
    errors.push(`${fieldName} must contain only lowercase letters, numbers, and hyphens`);
  } else if (chainSlug.length < 2 || chainSlug.length > 50) {
    errors.push(`${fieldName} must be between 2 and 50 characters`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function combineValidationResults(...results: ValidationResult[]): ValidationResult {
  const allErrors = results.flatMap(r => r.errors);
  return {
    valid: allErrors.length === 0,
    errors: allErrors
  };
}