import nodemailer from 'nodemailer';

// Plain local sendmail by default: on cPanel shared hosting the mail
// binary is right there (/usr/sbin/sendmail), so there's no hostname to
// resolve, no TLS cert to match, and no SMTP login — the three things that
// break one after another in a jail. Set SMTP_HOST to route through an
// external SMTP server instead (works the same way against any provider).
const transporter = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true', // true for port 465, false for 587/25
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    })
  : nodemailer.createTransport({
      sendmail: true,
      newline: 'unix',
      path: '/usr/sbin/sendmail',
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
