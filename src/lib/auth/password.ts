/**
 * NIST SP 800-63B Password Validation (Digital Identity Guidelines)
 * Latest recommendations:
 * - Minimum 8 characters
 * - Maximum at least 64 characters (we support longer)
 * - Check against common/breached passwords
 * - No mandatory composition rules (allow all printable characters)
 * - Reject passwords from breach lists
 * - Support passphrases (spaces allowed)
 */

// Common weak passwords and patterns to reject (NIST-recommended)
const COMMON_PASSWORDS = new Set([
  'password',
  '12345678',
  'qwerty',
  '123456',
  'admin',
  'letmein',
  'welcome',
  'monkey',
  'dragon',
  'master',
  'sunshine',
  'princess',
  'football',
  'shadow',
  'michael',
  'superman',
  'batman',
  'passw0rd',
  'p@ssw0rd',
  'password123',
  'admin123',
  'changeme',
  'temp',
  'test',
  'demo',
  '000000',
  '111111',
  '222222',
  '333333',
  '444444',
  '555555',
  '666666',
  '777777',
  '888888',
  '999999',
  'qwerty123',
  'abc123',
  'iloveyou',
  'trustno1',
]);

export interface PasswordValidationResult {
  valid: boolean;
  score: number; // 0-5: very weak to very strong
  errors: string[];
  warnings: string[];
  strength: 'very-weak' | 'weak' | 'fair' | 'good' | 'strong' | 'very-strong';
}

/**
 * Validate password against NIST SP 800-63B guidelines
 * Returns detailed validation result with score and strength level
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let score = 0;

  // Minimum length check (NIST: 8 characters minimum)
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  } else {
    score += 1;
  }

  // Maximum length check (support at least 64 chars as per NIST)
  if (password.length > 128) {
    warnings.push('Password is very long; consider using 12-64 characters for better usability');
  }

  // Check against common passwords (NIST requirement)
  const lowerPassword = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lowerPassword)) {
    errors.push('This password is too common and has been compromised. Choose a unique password');
  } else {
    score += 1;
  }

  // Simple pattern detection (not mandatory composition, but rewards complexity)
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumbers = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  const hasSpace = /\s/.test(password);

  let complexityCount = 0;
  if (hasLowercase) complexityCount++;
  if (hasUppercase) complexityCount++;
  if (hasNumbers) complexityCount++;
  if (hasSpecial || hasSpace) complexityCount++;

  if (complexityCount >= 3) {
    score += 1;
  } else if (complexityCount === 2) {
    warnings.push('Consider adding uppercase, numbers, or special characters for stronger security');
  }

  // Length bonus (longer = stronger)
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;

  // No repeated characters pattern (simple check)
  const repeatedPattern = /(.)\1{2,}/.test(password);
  if (repeatedPattern) {
    warnings.push('Avoid repeating the same character multiple times');
  } else {
    score += 1;
  }

  // Sequential characters check (simple)
  const hasSequential = /abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789/i.test(
    password
  );
  if (hasSequential) {
    warnings.push('Avoid sequential character patterns (e.g., "abc", "123")');
  }

  // Calculate final score (cap at 5)
  score = Math.min(score, 5);

  // Determine strength level
  let strength: PasswordValidationResult['strength'];
  if (score <= 1) strength = 'very-weak';
  else if (score === 2) strength = 'weak';
  else if (score === 3) strength = 'fair';
  else if (score === 4) strength = 'good';
  else if (score === 5) strength = 'very-strong';
  else strength = 'strong'; // fallback, shouldn't happen

  const valid = errors.length === 0 && password.length >= 8;

  return {
    valid,
    score,
    errors,
    warnings,
    strength,
  };
}

/**
 * Quick validation check - returns true only if password meets minimum NIST requirements
 * Useful for form submission checks
 */
export function isPasswordValid(password: string): boolean {
  return validatePassword(password).valid;
}

/**
 * Generate human-friendly strength indicator text
 */
export function getStrengthText(strength: PasswordValidationResult['strength']): string {
  const labels: Record<string, string> = {
    'very-weak': 'Very Weak - Not Acceptable',
    weak: 'Weak - Not Recommended',
    fair: 'Fair - Acceptable',
    good: 'Good - Recommended',
    strong: 'Strong - Recommended',
    'very-strong': 'Very Strong - Excellent',
  };
  return labels[strength] || strength;
}

/**
 * Get color class for password strength indicator
 */
export function getStrengthColor(strength: PasswordValidationResult['strength']): string {
  const colors: Record<string, string> = {
    'very-weak': 'text-cyber-red',
    weak: 'text-orange-500',
    fair: 'text-yellow-500',
    good: 'text-lime-500',
    strong: 'text-cyber-green',
    'very-strong': 'text-cyan-400',
  };
  return colors[strength] || 'text-text-secondary';
}
