import { prisma } from '@/lib/db';
import { createPerpetualLicense } from '@/lib/license';
import { sendLicenseEmail } from '@/lib/email';

// Per-payment diagnostics (what NOWPayments last told us, whether the key email
// went out). Stored as small JSON rows in the existing `settings` table so no
// schema change is needed. Always best-effort: a failure to record never blocks
// issuing a license.

export interface PayMeta {
  lastIpnStatus?: string;
  lastIpnAt?: string;
  emailSentAt?: string;
  emailError?: string;
}

const metaKey = (paymentId: string) => `pay.${paymentId}`;

export async function getPayMeta(paymentId: string): Promise<PayMeta> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: metaKey(paymentId) } });
    return row ? (JSON.parse(row.value) as PayMeta) : {};
  } catch {
    return {};
  }
}

export async function setPayMeta(paymentId: string, patch: PayMeta): Promise<void> {
  try {
    const current = await getPayMeta(paymentId);
    const value = JSON.stringify({ ...current, ...patch });
    await prisma.setting.upsert({
      where: { key: metaKey(paymentId) },
      create: { key: metaKey(paymentId), value },
      update: { value },
    });
  } catch (e) {
    console.error('payments: could not record diagnostics', e);
  }
}

/**
 * Sends the license email for a confirmed payment and records the outcome.
 * Never throws: a mail problem must not turn a successful payment into a
 * failed webhook (which used to leave the buyer with a license but no email).
 */
export async function emailPaymentLicense(paymentId: string): Promise<boolean> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { license: true },
  });
  if (!payment?.license) return false;
  try {
    await sendLicenseEmail(payment.email, payment.license.key, false);
    await setPayMeta(paymentId, { emailSentAt: new Date().toISOString(), emailError: '' });
    return true;
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).slice(0, 300);
    console.error('payments: license email failed for payment', paymentId, msg);
    await setPayMeta(paymentId, { emailError: msg });
    return false;
  }
}

/**
 * Marks a payment confirmed, creates its license (once) and emails the key.
 * Safe to call repeatedly (webhook retries, admin button): the status flip is a
 * conditional update, so only one caller creates the license.
 */
export async function fulfillPayment(
  paymentId: string,
  payCurrency?: string | null
): Promise<{ ok: boolean; created: boolean; emailed: boolean; reason?: string }> {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return { ok: false, created: false, emailed: false, reason: 'Unknown payment' };

  await prisma.payment.updateMany({
    where: { id: paymentId, status: { not: 'CONFIRMED' } },
    data: { status: 'CONFIRMED', confirmedAt: new Date(), payCurrency: payCurrency ?? payment.payCurrency },
  });

  let created = false;
  const fresh = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (fresh && !fresh.licenseId) {
    // Covers both the normal case and a retry after an earlier attempt claimed
    // the payment but died before the license was made. Race-safe: whoever
    // links their license first wins; any extra license is deleted again.
    const license = await createPerpetualLicense(fresh.email);
    const linked = await prisma.payment.updateMany({
      where: { id: paymentId, licenseId: null },
      data: { licenseId: license.id },
    });
    if (linked.count === 1) created = true;
    else await prisma.license.delete({ where: { id: license.id } });
  }

  const meta = await getPayMeta(paymentId);
  let emailed = Boolean(meta.emailSentAt);
  if (!emailed) emailed = await emailPaymentLicense(paymentId);
  return { ok: true, created, emailed };
}
