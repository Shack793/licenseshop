import nodemailer from 'nodemailer';

// Plain SMTP instead of a third-party email API (Resend, etc.) so this can
// send through the mailbox that already comes free with Namecheap hosting
// (cPanel -> Email Accounts -> create one, e.g. licenses@blackjack.us) —
// no separate email service or its own billing to set up. Works the same
// way against any other SMTP provider too if you'd rather use one.
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true', // true for port 465, false for 587/25
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

const PRODUCT_NAME = 'Hi-Opt II Counter';
const APP_URL = `${process.env.NEXTAUTH_URL || 'https://blackjacklab.us'}/app`;

export async function sendVerificationEmail(to: string, verifyUrl: string) {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM!,
    to,
    subject: `Confirm your email to get your ${PRODUCT_NAME} trial key`,
    text: `Click to confirm your email and get your ${PRODUCT_NAME} trial license key:\n\n${verifyUrl}\n\nThis link expires in 30 minutes.`,
  });
}

export async function sendResendVerificationEmail(to: string, verifyUrl: string) {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM!,
    to,
    subject: `Confirm your email to resend your ${PRODUCT_NAME} key`,
    text: `Click to confirm your email and we'll resend your existing ${PRODUCT_NAME} license key(s):\n\n${verifyUrl}\n\nThis link expires in 30 minutes. This won't issue a new trial — it only resends keys you already have.`,
  });
}

export async function sendLicenseEmail(
  to: string,
  licenseKey: string,
  isTrial: boolean,
  trialDays?: number
) {
  const subject = isTrial
    ? `Your ${PRODUCT_NAME} trial license key`
    : `Your ${PRODUCT_NAME} license key — thanks for your purchase`;
  const body = isTrial
    ? `Your ${trialDays ?? 3}-day ${PRODUCT_NAME} trial license key is:\n\n${licenseKey}\n\nOpen the app at ${APP_URL} and paste this key to start your trial. The trial runs for ${trialDays ?? 3} days from today — after that the app locks until you buy a license. Keep this email — there's no account to log back into, so this key is how you get back in.`
    : `Thanks for your purchase! Your ${PRODUCT_NAME} license key is:\n\n${licenseKey}\n\nThis key is for life — keep this email somewhere safe. Open the app at ${APP_URL} and paste your key to get started.`;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM!,
    to,
    subject,
    text: body,
  });
}
