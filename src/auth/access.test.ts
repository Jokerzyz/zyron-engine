import { describe, expect, it } from 'vitest';
import { authErrorTranslationKey, hasVerifiedAccountAccess } from './access';

describe('account access', () => {
  it('requires a verified, non-anonymous Firebase account', () => {
    expect(hasVerifiedAccountAccess(null)).toBe(false);
    expect(hasVerifiedAccountAccess({ isAnonymous: true, emailVerified: true })).toBe(false);
    expect(hasVerifiedAccountAccess({ isAnonymous: false, emailVerified: false })).toBe(false);
    expect(hasVerifiedAccountAccess({ isAnonymous: false, emailVerified: true })).toBe(true);
  });

  it('maps Firebase errors without exposing implementation messages', () => {
    expect(authErrorTranslationKey({ code: 'auth/invalid-email' })).toBe('msg_auth_invalid_email');
    expect(authErrorTranslationKey({ code: 'auth/wrong-password' })).toBe('msg_auth_invalid_credentials');
    expect(authErrorTranslationKey(new Error('secret implementation detail'))).toBe('msg_auth_unknown');
  });
});
