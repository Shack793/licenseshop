import { NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveSmtp, sendMailWith, type SmtpConfig } from '@/lib/email';
import {
export const dynamic = 'force-dynamic';

  renderTemplate,
  SAMPLE_VARS,
  TEMPLATE_KINDS,
  type TemplateKind,
} from '@/lib/email-templates';

// Sends a test message using the values currently in the admin form (so you
// can try settings BEFORE saving them). A blank password means "use the saved one".

const schema = z.object({
  to: z.string().trim().email(),
  smtp: z
    .object({
      host: z.string().trim(),
      port: z.number().int().min(1).max(65535),
      secure: z.boolean(),
      user: z.string().trim(),
      password: z.string().optional(),
      fromEmail: z.string().trim().email(),
      fromName: z.string().trim(),
      replyTo: z.string().trim(),
    })
    .optional(),
  // Optionally preview an email: sample values are filled in.
  template: z.object({ kind: z.string(), subject: z.string(), body: z.string() }).optional(),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter a valid address to send the test to' }, { status: 400 });
  }
  const { to, smtp, template } = parsed.data;

  const saved = await resolveSmtp();
  const config: SmtpConfig = smtp
    ? { ...smtp, password: smtp.password ? smtp.password : saved.config.password }
    : saved.config;

  let subject = 'SMTP test — Hi-Opt II Counter';
  let text = 'If you can read this, your SMTP settings work and customers will receive their emails.';
  if (template) {
    if (!(TEMPLATE_KINDS as string[]).includes(template.kind as TemplateKind)) {
      return NextResponse.json({ error: 'Unknown email' }, { status: 400 });
    }
    subject = `[TEST] ${renderTemplate(template.subject, SAMPLE_VARS)}`;
    text = renderTemplate(template.body, SAMPLE_VARS);
  }

  try {
    await sendMailWith(config, to, subject, text);
    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Send failed';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
