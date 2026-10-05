// A short, maintainable starter list of common disposable-email domains.
// This is a cheap first filter, not a complete solution — pair it with
// email verification (the real gate) rather than relying on this alone.
// Consider swapping this for a maintained API (e.g. Kickbox, or the
// open-source "disposable-email-domains" package) once volume justifies it.
const DISPOSABLE_DOMAINS = new Set([
  '10minutemail.com',
  'guerrillamail.com',
  'guerrillamail.info',
  'mailinator.com',
  'tempmail.com',
  'temp-mail.org',
  'yopmail.com',
  'throwawaymail.com',
  'getnada.com',
  'trashmail.com',
  'fakeinbox.com',
  'sharklasers.com',
  'dispostable.com',
]);

export function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase().trim();
  if (!domain) return true; // malformed email, treat as suspicious
  return DISPOSABLE_DOMAINS.has(domain);
}
