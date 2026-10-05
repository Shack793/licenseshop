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

const PRODUCT_NAME = 'Shoepilot Pro';

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
    ? `Your ${trialDays ?? 3}-day ${PRODUCT_NAME} trial license key is:\n\n${licenseKey}\n\nEnter this in the app to activate your trial. Keep this email — there's no account to log back into, so this key (and the "check your license" page on the site) is how you check your status or grab updates later.`
    : `Thanks for your purchase! Your ${PRODUCT_NAME} license key is:\n\n${licenseKey}\n\nThis key is perpetual — keep this email somewhere safe. Use the "check your license" page on the site anytime to see its status or download the latest version.`;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM!,
    to,
    subject,
    text: body,
  });
}
