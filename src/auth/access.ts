export interface AccountUser {
  emailVerified: boolean;
  isAnonymous: boolean;
}
export function hasVerifiedAccountAccess(user: AccountUser | null | undefined): boolean {
  return Boolean(user && !user.isAnonymous && user.emailVerified);
}

const firebaseErrorKeys: Record<string, string> = {
  'auth/account-exists-with-different-credential': 'msg_auth_provider_mismatch',
  'auth/email-already-in-use': 'msg_auth_email_used',
  'auth/invalid-credential': 'msg_auth_invalid_credentials',
  'auth/invalid-email': 'msg_auth_invalid_email',
  'auth/network-request-failed': 'msg_auth_network',
  'auth/operation-not-allowed': 'msg_auth_disabled',
  'auth/popup-blocked': 'msg_auth_popup_blocked',
  'auth/popup-closed-by-user': 'msg_auth_popup_closed',
  'auth/too-many-requests': 'msg_auth_too_many',
  'auth/unauthorized-domain': 'msg_auth_unauthorized_domain',
  'auth/user-disabled': 'msg_auth_user_disabled',
  'auth/user-not-found': 'msg_auth_invalid_credentials',
  'auth/weak-password': 'msg_auth_weak_password',
  'auth/wrong-password': 'msg_auth_invalid_credentials',
};

export function authErrorTranslationKey(error: unknown): string {
  if (!error || typeof error !== 'object' || !('code' in error)) return 'msg_auth_unknown';
  const code = String((error as { code?: unknown }).code ?? '');
  return firebaseErrorKeys[code] ?? 'msg_auth_unknown';
}
