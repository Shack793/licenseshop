import nodemailer from 'nodemailer';
import { getSettings, decryptSecret } from '@/lib/settings';
import {
  DEFAULT_TEMPLATES,
  renderTemplate,
  type EmailTemplate,
  type TemplateKind,
} from '@/lib/email-templates';

// No third-party email API. Connection details and wording are editable at
// /admin/email; anything unset there falls back to SMTP_* / EMAIL_FROM env
// vars and built-in wording. With no SMTP host configured anywhere, mail goes
// out through local sendmail (/usr/sbin/sendmail) — the Namecheap default.

const PRODUCT_NAME = 'Hi-Opt II Counter';
const appUrl = () => `${process.env.NEXTAUTH_URL || 'https://blackjacklab.us'}/app`;

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromEmail: string;
  fromName: string;
  replyTo: string;
}

export interface ResolvedSmtp {
  config: SmtpConfig;
  /** Whether a password is available (from the DB or the environment). */
  passwordSet: boolean;
  /** Set when a stored password exists but can't be decrypted (ADMIN_SESSION_SECRET changed). */
  passwordError: string | null;
}

export async function resolveSmtp(): Promise<ResolvedSmtp> {
  const s = await getSettings();
  const env = process.env;
  const pick = (k: string, fallback: string | undefined) => {
    const v = s.get(k);
    return v !== undefined && v !== '' ? v : fallback ?? '';
  };

  let password = env.SMTP_PASSWORD ?? '';
  let passwordError: string | null = null;
  const stored = s.get('smtp.password');
  if (stored) {
    const dec = decryptSecret(stored);
    if (dec === null) {
      passwordError =
        'The saved SMTP password could not be decrypted (ADMIN_SESSION_SECRET changed?). Enter it again and save.';
    } else {
      password = dec;
    }
  }

  const port = Number(pick('smtp.port', env.SMTP_PORT || '587'));
  const secureRaw = s.get('smtp.secure');
  const secure = secureRaw !== undefined ? secureRaw === 'true' : env.SMTP_SECURE === 'true';

  return {
    config: {
      host: pick('smtp.host', env.SMTP_HOST),
      port: Number.isFinite(port) && port > 0 ? port : 587,
      secure,
      user: pick('smtp.user', env.SMTP_USER),
      password,
      fromEmail: pick('smtp.from', env.EMAIL_FROM),
      fromName: pick('smtp.fromName', ''),
      replyTo: pick('smtp.replyTo', ''),
    },
    passwordSet: password !== '',
    passwordError,
  };
}

export async function getTemplate(kind: TemplateKind): Promise<EmailTemplate & { isCustom: boolean }> {
  const s = await getSettings();
  const subject = s.get(`tpl.${kind}.subject`);
  const body = s.get(`tpl.${kind}.body`);
  const def = DEFAULT_TEMPLATES[kind];
  return {
    subject: subject || def.subject,
    body: body || def.body,
    isCustom: Boolean(subject || body),
  };
}

function transportFor(c: SmtpConfig) {
  // No host configured (the Namecheap default) → local sendmail. No DNS
  // lookup, no TLS cert, no login — the three things that break one after
  // another inside shared-hosting jails.
  if (!c.host) {
    return nodemailer.createTransport({
      sendmail: true,
      newline: 'unix',
      path: '/usr/sbin/sendmail',
    });
  }
  return nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.secure,
    auth: c.user ? { user: c.user, pass: c.password } : undefined,
    // Fail in seconds, not minutes, if the host/port is wrong.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

export async function sendMailWith(
  smtp: SmtpConfig,
  to: string,
  subject: string,
  text: string
): Promise<void> {
  if (!smtp.fromEmail) throw new Error('"From" email address is not set');
  const name = smtp.fromName.replace(/[\r\n"<>]/g, '').trim();
  await transportFor(smtp).sendMail({
    from: name ? { name, address: smtp.fromEmail } : smtp.fromEmail,
    replyTo: smtp.replyTo || undefined,
    to,
    subject: subject.replace(/[\r\n]+/g, ' '),
    text,
  });
}

export async function sendTemplated(
  kind: TemplateKind,
  to: string,
  vars: Record<string, string | number | undefined>
): Promise<void> {
  const [{ config }, tpl] = await Promise.all([resolveSmtp(), getTemplate(kind)]);
  const all = { productName: PRODUCT_NAME, appUrl: appUrl(), email: to, ...vars };
  await sendMailWith(config, to, renderTemplate(tpl.subject, all), renderTemplate(tpl.body, all));
}

export async function sendVerificationEmail(to: string, verifyUrl: string, trialDays?: number) {
  await sendTemplated('trial_verify', to, {
    verifyUrl,
    trialDays: trialDays ?? Number(process.env.TRIAL_DAYS ?? '3'),
  });
}

export async function sendResendVerificationEmail(to: string, verifyUrl: string) {
  await sendTemplated('resend_verify', to, { verifyUrl });
}

export async function sendLicenseEmail(
  to: string,
  licenseKey: string,
  isTrial: boolean,
  trialDays?: number
) {
  await sendTemplated(isTrial ? 'trial_key' : 'purchase_key', to, {
    key: licenseKey,
    trialDays: trialDays ?? Number(process.env.TRIAL_DAYS ?? '3'),
  });
}
