import crypto from 'crypto';
import { prisma } from './db';
import { LicenseStatus } from '@prisma/client';

/**
 * License keys are opaque random strings stored in the DB, not
 * self-contained signed tokens. The bot MUST call /api/license/validate
 * online rather than validating offline — that's what lets a refund or
 * abuse case revoke a license immediately instead of waiting for a
 * client-side token to expire.
 */

const KEY_GROUPS = 4;
const KEY_GROUP_LENGTH = 5;

export function generateLicenseKey(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I ambiguity
  const groups: string[] = [];
  for (let g = 0; g < KEY_GROUPS; g++) {
    let group = '';
    const bytes = crypto.randomBytes(KEY_GROUP_LENGTH);
    for (let i = 0; i < KEY_GROUP_LENGTH; i++) {
      group += alphabet[bytes[i] % alphabet.length];
    }
    groups.push(group);
  }
  return groups.join('-');
}

export async function createPerpetualLicense(email: string, tier = 'standard') {
  const key = generateLicenseKey();
  return prisma.license.create({
    data: {
      key,
      email: email.toLowerCase(),
      tier,
      status: LicenseStatus.ACTIVE,
      isTrial: false,
      expiresAt: null,
      deviceLimit: 2,
    },
  });
}

// Called only after the email has been verified (see /api/trial/verify).
// No per-email uniqueness check here on purpose — that's a weak signal
// without accounts. The real trial-abuse defense is the device-hash lock
// in validateLicenseKey below, applied at activation time.
export async function createTrialLicense(email: string, trialDays: number) {
  const key = generateLicenseKey();
  const expiresAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);

  return prisma.license.create({
    data: {
      key,
      email: email.toLowerCase(),
      tier: 'trial',
      status: LicenseStatus.TRIAL,
      isTrial: true,
      expiresAt,
      deviceLimit: 1,
    },
  });
}

export type ValidationResult =
  | { valid: true; tier: string; expiresAt: string | null; isTrial: boolean }
  | { valid: false; reason: string };

// Called by the bot client on launch, and whenever a device activates a key.
export async function validateLicenseKey(
  key: string,
  deviceHash?: string
): Promise<ValidationResult> {
  const license = await prisma.license.findUnique({
    where: { key },
    include: { activations: true },
  });

  if (!license) return { valid: false, reason: 'NOT_FOUND' };
  if (license.status === LicenseStatus.REVOKED) return { valid: false, reason: 'REVOKED' };

  if (license.expiresAt && license.expiresAt < new Date()) {
    if (license.status !== LicenseStatus.EXPIRED) {
      await prisma.license.update({
        where: { id: license.id },
        data: { status: LicenseStatus.EXPIRED },
      });
    }
    return { valid: false, reason: 'EXPIRED' };
  }

  if (deviceHash) {
    const alreadyActivatedOnThisLicense = license.activations.some(
      (a) => a.deviceHash === deviceHash
    );

    if (!alreadyActivatedOnThisLicense) {
      // --- Trial-abuse defense: device-fingerprint cross-license lock ---
      // If this is a trial license, check whether this device has EVER
      // activated a DIFFERENT trial license before. If so, block it —
      // regardless of the email or key used this time. This is the check
      // that a fresh email address alone can't get around.
      if (license.isTrial) {
        const existingLock = await prisma.trialDeviceLock.findUnique({ where: { deviceHash } });
        if (existingLock && existingLock.licenseId !== license.id) {
          return { valid: false, reason: 'TRIAL_ALREADY_USED_ON_DEVICE' };
        }
      }

      if (license.activationsUsed >= license.deviceLimit) {
        return { valid: false, reason: 'DEVICE_LIMIT_REACHED' };
      }

      await prisma.$transaction([
        prisma.activation.create({ data: { licenseId: license.id, deviceHash } }),
        prisma.license.update({
          where: { id: license.id },
          data: { activationsUsed: { increment: 1 } },
        }),
      ]);

      if (license.isTrial) {
        // Lock this device to this trial license, first-activation-wins.
        await prisma.trialDeviceLock.upsert({
          where: { deviceHash },
          create: { deviceHash, licenseId: license.id },
          update: {}, // don't overwrite an existing lock from another license
        });
      }
    } else {
      await prisma.activation.updateMany({
        where: { licenseId: license.id, deviceHash },
        data: { lastSeenAt: new Date() },
      });
    }
  }

  return {
    valid: true,
    tier: license.tier,
    expiresAt: license.expiresAt ? license.expiresAt.toISOString() : null,
    isTrial: license.isTrial,
  };
}

// Used by the "check your license" page — read-only, no activation side effects.
export async function getLicenseStatus(key: string) {
  const license = await prisma.license.findUnique({ where: { key } });
  if (!license) return null;

  const expired = license.expiresAt ? license.expiresAt < new Date() : false;
  return {
    key: license.key,
    tier: license.tier,
    isTrial: license.isTrial,
    status: expired ? 'EXPIRED' : license.status,
    expiresAt: license.expiresAt ? license.expiresAt.toISOString() : null,
    valid: license.status !== 'REVOKED' && !expired,
  };
}
