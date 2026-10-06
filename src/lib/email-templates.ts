// Pure (no DB / no Node-only imports) so it can be shared by the sender, the
// admin API and tests. Emails are plain text on purpose: the admin writes the
// wording, customers' values are only ever substituted into text, so there is
// nothing to escape or inject.

export type TemplateKind = 'trial_verify' | 'trial_key' | 'purchase_key' | 'resend_verify';

export const TEMPLATE_KINDS: TemplateKind[] = ['trial_verify', 'trial_key', 'purchase_key', 'resend_verify'];

export interface TemplateMeta {
  kind: TemplateKind;
  label: string;
  when: string;
  placeholders: string[];
  /** Placeholders that MUST appear, otherwise the customer would get an email they can't use. */
  required: string[];
}

export const PLACEHOLDER_HELP: Record<string, string> = {
  productName: 'Product name (Hi-Opt II Counter)',
  key: "The customer's license key",
  trialDays: 'Length of the free trial in days',
  appUrl: 'Link to the app (/app)',
  verifyUrl: 'The email-confirmation link',
  email: "The customer's email address",
};

export const TEMPLATE_META: TemplateMeta[] = [
  {
    kind: 'trial_verify',
    label: 'Free trial — confirm your email',
    when: 'Sent right after someone asks for a free trial, before the key is issued.',
    placeholders: ['productName', 'verifyUrl', 'trialDays', 'email'],
    required: ['verifyUrl'],
  },
  {
    kind: 'trial_key',
    label: 'Free trial — your key',
    when: 'Sent once they have confirmed their email and the trial starts.',
    placeholders: ['productName', 'key', 'trialDays', 'appUrl', 'email'],
    required: ['key'],
  },
  {
    kind: 'purchase_key',
    label: 'Purchase — your key',
    when: 'Sent when a crypto payment is confirmed.',
    placeholders: ['productName', 'key', 'appUrl', 'email'],
    required: ['key'],
  },
  {
    kind: 'resend_verify',
    label: 'Lost key — confirm your email',
    when: 'Sent when someone asks for their existing key(s) to be resent.',
    placeholders: ['productName', 'verifyUrl', 'email'],
    required: ['verifyUrl'],
  },
];

export interface EmailTemplate {
  subject: string;
  body: string;
}

export const DEFAULT_TEMPLATES: Record<TemplateKind, EmailTemplate> = {
  trial_verify: {
    subject: 'Confirm your email to get your {{productName}} trial key',
    body:
      'Click to confirm your email and get your {{productName}} trial license key:\n\n{{verifyUrl}}\n\nThis link expires in 30 minutes.',
  },
  trial_key: {
    subject: 'Your {{productName}} trial license key',
    body:
      'Your {{trialDays}}-day {{productName}} trial license key is:\n\n{{key}}\n\nOpen the app at {{appUrl}} and paste this key to start your trial. The trial runs for {{trialDays}} days from today — after that the app locks until you buy a license. Keep this email — there is no account to log back into, so this key is how you get back in.',
  },
  purchase_key: {
    subject: 'Your {{productName}} license key — thanks for your purchase',
    body:
      'Thanks for your purchase! Your {{productName}} license key is:\n\n{{key}}\n\nThis key is for life — keep this email somewhere safe. Open the app at {{appUrl}} and paste your key to get started.',
  },
  resend_verify: {
    subject: 'Confirm your email to resend your {{productName}} key',
    body:
      "Click to confirm your email and we'll resend your existing {{productName}} license key(s):\n\n{{verifyUrl}}\n\nThis link expires in 30 minutes. This won't issue a new trial — it only resends keys you already have.",
  },
};

export const MAX_SUBJECT = 200;
export const MAX_BODY = 10000;

const PLACEHOLDER_RE = /\{\{\s*([A-Za-z]+)\s*\}\}/g;

export function renderTemplate(text: string, vars: Record<string, string | number | undefined>): string {
  return text.replace(PLACEHOLDER_RE, (_m, name: string) => {
    const v = vars[name];
    return v === undefined ? '' : String(v);
  });
}

export function placeholdersIn(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(PLACEHOLDER_RE)) found.add(m[1]);
  return [...found];
}

/** Returns a human-readable error, or null if the template is OK to save. */
export function validateTemplate(kind: TemplateKind, t: EmailTemplate): string | null {
  const meta = TEMPLATE_META.find((m) => m.kind === kind);
  if (!meta) return 'Unknown template';
  if (!t.subject.trim()) return 'Subject cannot be empty';
  if (/[\r\n]/.test(t.subject)) return 'Subject must be a single line';
  if (t.subject.length > MAX_SUBJECT) return `Subject is too long (max ${MAX_SUBJECT} characters)`;
  if (!t.body.trim()) return 'Message cannot be empty';
  if (t.body.length > MAX_BODY) return `Message is too long (max ${MAX_BODY} characters)`;
  const used = new Set([...placeholdersIn(t.subject), ...placeholdersIn(t.body)]);
  for (const r of meta.required) {
    if (!placeholdersIn(t.body).includes(r)) {
      return `The message must include {{${r}}} — without it the customer can't use the email`;
    }
  }
  for (const u of used) {
    if (!meta.placeholders.includes(u)) {
      return `{{${u}}} isn't available in this email. Available: ${meta.placeholders.map((p) => `{{${p}}}`).join(', ')}`;
    }
  }
  return null;
}

export const SAMPLE_VARS: Record<string, string> = {
  productName: 'Hi-Opt II Counter',
  key: 'ABCDE-FGHIJ-KLMNO-PQRST',
  trialDays: '3',
  appUrl: 'https://blackjack.us/app',
  verifyUrl: 'https://blackjack.us/api/trial/verify?token=SAMPLE',
  email: 'customer@example.com',
};
