/**
 * validation.test.js — Tests for utils/validation.js
 */

const {
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
  validateDisplayName,
  validateInviteCode,
  validateTextContent,
  validateTitle,
  validatePin,
  validatePinConfirmation,
  collectErrors,
} = require('../../utils/validation');

describe('validateEmail', () => {
  it('accepts valid email addresses', () => {
    expect(validateEmail('user@example.com').valid).toBe(true);
    expect(validateEmail('user+tag@sub.domain.co').valid).toBe(true);
    expect(validateEmail('  trimmed@email.com  ').valid).toBe(true);
  });

  it('rejects empty or blank input', () => {
    expect(validateEmail('').valid).toBe(false);
    expect(validateEmail('  ').valid).toBe(false);
    expect(validateEmail(null).valid).toBe(false);
  });

  it('rejects malformed addresses', () => {
    expect(validateEmail('notanemail').valid).toBe(false);
    expect(validateEmail('@domain.com').valid).toBe(false);
    expect(validateEmail('user@').valid).toBe(false);
    expect(validateEmail('user@domain').valid).toBe(false);
  });

  it('rejects excessively long email', () => {
    const long = 'a'.repeat(250) + '@b.co'; // 255 chars — over the 254-char RFC limit
    expect(validateEmail(long).valid).toBe(false);
  });
});

describe('validatePassword', () => {
  it('accepts valid passwords', () => {
    expect(validatePassword('securepass123').valid).toBe(true);
    expect(validatePassword('12345678').valid).toBe(true);
    expect(validatePassword('a'.repeat(128)).valid).toBe(true);
  });

  it('rejects empty password', () => {
    expect(validatePassword('').valid).toBe(false);
    expect(validatePassword(null).valid).toBe(false);
  });

  it('rejects passwords shorter than 8 characters', () => {
    expect(validatePassword('1234567').valid).toBe(false);
    expect(validatePassword('short').valid).toBe(false);
  });

  it('rejects passwords over 128 characters', () => {
    expect(validatePassword('a'.repeat(129)).valid).toBe(false);
  });
});

describe('validatePasswordConfirmation', () => {
  it('accepts matching passwords', () => {
    expect(validatePasswordConfirmation('mypassword', 'mypassword').valid).toBe(true);
  });

  it('rejects mismatched passwords', () => {
    expect(validatePasswordConfirmation('password1', 'password2').valid).toBe(false);
  });

  it('rejects empty confirmation', () => {
    expect(validatePasswordConfirmation('password', '').valid).toBe(false);
    expect(validatePasswordConfirmation('password', null).valid).toBe(false);
  });
});

describe('validateDisplayName', () => {
  it('accepts normal names', () => {
    expect(validateDisplayName('Alice').valid).toBe(true);
    expect(validateDisplayName('José').valid).toBe(true);
    expect(validateDisplayName('李明').valid).toBe(true);
    expect(validateDisplayName('Bob 2').valid).toBe(true);
  });

  it('rejects empty or whitespace-only names', () => {
    expect(validateDisplayName('').valid).toBe(false);
    expect(validateDisplayName('   ').valid).toBe(false);
    expect(validateDisplayName(null).valid).toBe(false);
  });

  it('rejects names over maxLength', () => {
    expect(validateDisplayName('a'.repeat(51)).valid).toBe(false);
    expect(validateDisplayName('a'.repeat(50)).valid).toBe(true);
  });

  it('respects custom maxLength option', () => {
    expect(validateDisplayName('12', { maxLength: 3 }).valid).toBe(true);
    expect(validateDisplayName('1234', { maxLength: 3 }).valid).toBe(false);
  });

  it('rejects names with no letters or numbers', () => {
    expect(validateDisplayName('!!!').valid).toBe(false);
    expect(validateDisplayName('---').valid).toBe(false);
  });

  it('uses custom fieldLabel in error messages', () => {
    const result = validateDisplayName('', { fieldLabel: 'Partner name' });
    expect(result.error).toContain('Partner name');
  });
});

describe('validateInviteCode', () => {
  it('accepts valid codes', () => {
    expect(validateInviteCode('ABC123').valid).toBe(true);
    expect(validateInviteCode('XYZABC').valid).toBe(true);
    expect(validateInviteCode('abc123').valid).toBe(true); // lowercase OK
    expect(validateInviteCode('AB-CD12').valid).toBe(true); // dashes stripped
  });

  it('rejects empty or blank codes', () => {
    expect(validateInviteCode('').valid).toBe(false);
    expect(validateInviteCode('  ').valid).toBe(false);
    expect(validateInviteCode(null).valid).toBe(false);
  });

  it('rejects codes that are too short', () => {
    expect(validateInviteCode('AB').valid).toBe(false);
    expect(validateInviteCode('ABCD').valid).toBe(false);
  });

  it('rejects codes with special characters', () => {
    expect(validateInviteCode('AB!@#$').valid).toBe(false);
  });
});

describe('validateTextContent', () => {
  it('accepts normal text', () => {
    expect(validateTextContent('Hello world').valid).toBe(true);
    expect(validateTextContent('').valid).toBe(true); // empty OK when not required
  });

  it('rejects empty when required', () => {
    expect(validateTextContent('', { required: true }).valid).toBe(false);
    expect(validateTextContent('   ', { required: true }).valid).toBe(false);
  });

  it('rejects text over maxLength', () => {
    const long = 'a'.repeat(5001);
    expect(validateTextContent(long).valid).toBe(false);
  });

  it('respects custom maxLength', () => {
    expect(validateTextContent('hello', { maxLength: 4 }).valid).toBe(false);
    expect(validateTextContent('hell', { maxLength: 4 }).valid).toBe(true);
  });
});

describe('validateTitle', () => {
  it('accepts valid titles', () => {
    expect(validateTitle('My journal entry').valid).toBe(true);
    expect(validateTitle('').valid).toBe(true); // optional by default
  });

  it('rejects empty when required', () => {
    expect(validateTitle('', { required: true }).valid).toBe(false);
  });

  it('rejects titles over 200 characters', () => {
    expect(validateTitle('a'.repeat(201)).valid).toBe(false);
    expect(validateTitle('a'.repeat(200)).valid).toBe(true);
  });
});

describe('validatePin', () => {
  it('accepts valid PINs', () => {
    expect(validatePin('1234').valid).toBe(true);
    expect(validatePin('9876').valid).toBe(true);
    expect(validatePin('1357').valid).toBe(true);
  });

  it('rejects empty PIN', () => {
    expect(validatePin('').valid).toBe(false);
    expect(validatePin(null).valid).toBe(false);
  });

  it('rejects non-numeric PINs', () => {
    expect(validatePin('12AB').valid).toBe(false);
    expect(validatePin('12.4').valid).toBe(false);
  });

  it('rejects wrong length', () => {
    expect(validatePin('123').valid).toBe(false);   // too short
    expect(validatePin('12345').valid).toBe(false); // too long
  });

  it('rejects all-same-digit PINs (weak)', () => {
    expect(validatePin('1111').valid).toBe(false);
    expect(validatePin('0000').valid).toBe(false);
    expect(validatePin('9999').valid).toBe(false);
  });

  it('respects custom length', () => {
    expect(validatePin('123456', 6).valid).toBe(true);
    expect(validatePin('1234', 6).valid).toBe(false);
  });
});

describe('validatePinConfirmation', () => {
  it('accepts matching PINs', () => {
    expect(validatePinConfirmation('1234', '1234').valid).toBe(true);
  });

  it('rejects mismatched PINs', () => {
    expect(validatePinConfirmation('1234', '5678').valid).toBe(false);
  });

  it('rejects empty confirmation', () => {
    expect(validatePinConfirmation('1234', '').valid).toBe(false);
  });
});

describe('collectErrors', () => {
  it('returns valid when all checks pass', () => {
    const result = collectErrors(
      validateEmail('user@example.com'),
      validatePassword('securepass')
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('collects all error messages', () => {
    const result = collectErrors(
      validateEmail('bad'),
      validatePassword('short'),
      validatePin('0000')
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(3);
    result.errors.forEach(e => expect(typeof e).toBe('string'));
  });

  it('returns only failed errors when mixed results', () => {
    const result = collectErrors(
      validateEmail('good@email.com'),   // passes
      validatePassword('short')          // fails
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
  });
});
