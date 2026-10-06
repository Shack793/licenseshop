import { NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveSmtp, getTemplate } from '@/lib/email';
import { encryptSecret, saveSettings } from '@/lib/settings';
import {
  DEFAULT_TEMPLATES,
  PLACEHOLDER_HELP,
  TEMPLATE_KINDS,
  TEMPLATE_META,
  validateTemplate,
  type TemplateKind,
} from '@/lib/email-templates';

export const dynamic = 'force-dynamic';

// Behind the admin middleware (/api/admin/*). The SMTP password is write-only:
// it is never sent back to the browser, only whether one is set.

export async function GET() {
  const { config, passwordSet, passwordError } = await resolveSmtp();
  const templates: Record<string, { subject: string; body: string; isCustom: boolean }> = {};
  for (const kind of TEMPLATE_KINDS) templates[kind] = await getTemplate(kind);

  return NextResponse.json({
    smtp: {
      host: config.host,
      port: config.port,
      secure: config.secure,
      user: config.user,
      fromEmail: config.fromEmail,
      fromName: config.fromName,
      replyTo: config.replyTo,
      passwordSet,
      passwordError,
    },
    templates,
    defaults: DEFAULT_TEMPLATES,
    meta: TEMPLATE_META,
    placeholderHelp: PLACEHOLDER_HELP,
  });
}

const templateSchema = z.object({ subject: z.string(), body: z.string() });

const saveSchema = z.object({
  smtp: z
    .object({
      host: z.string().trim().max(255),
      port: z.number().int().min(1).max(65535),
      secure: z.boolean(),
      user: z.string().trim().max(255),
      // undefined/'' = keep the saved password; non-empty = replace it.
      password: z.string().max(500).optional(),
      fromEmail: z.string().trim().email(),
      fromName: z.string().trim().max(100),
      replyTo: z.union([z.literal(''), z.string().trim().email()]),
    })
    .optional(),
  templates: z.record(z.string(), templateSchema).optional(),
});

export async function PUT(req: Request) {
  const parsed = saveSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: `Check "${first.path.join('.')}": ${first.message}` },
      { status: 400 }
    );
  }
  const { smtp, templates } = parsed.data;

  const values: Record<string, string> = {};
  const remove: string[] = [];

  if (smtp) {
    values['smtp.host'] = smtp.host;
    values['smtp.port'] = String(smtp.port);
    values['smtp.secure'] = String(smtp.secure);
    values['smtp.user'] = smtp.user;
    values['smtp.from'] = smtp.fromEmail;
    values['smtp.fromName'] = smtp.fromName;
    values['smtp.replyTo'] = smtp.replyTo;
    if (smtp.password) values['smtp.password'] = encryptSecret(smtp.password);
  }

  if (templates) {
    for (const [kind, t] of Object.entries(templates)) {
      if (!(TEMPLATE_KINDS as string[]).includes(kind)) {
        return NextResponse.json({ error: `Unknown email: ${kind}` }, { status: 400 });
      }
      const def = DEFAULT_TEMPLATES[kind as TemplateKind];
      // Identical to the built-in wording -> store nothing, so future default
      // improvements still apply and "reset to default" is just deleting rows.
      if (t.subject === def.subject && t.body === def.body) {
        remove.push(`tpl.${kind}.subject`, `tpl.${kind}.body`);
        continue;
      }
      const err = validateTemplate(kind as TemplateKind, t);
      if (err) {
        const label = TEMPLATE_META.find((m) => m.kind === kind)?.label ?? kind;
        return NextResponse.json({ error: `${label}: ${err}` }, { status: 400 });
      }
      values[`tpl.${kind}.subject`] = t.subject;
      values[`tpl.${kind}.body`] = t.body;
    }
  }

  await saveSettings(values, remove);
  return NextResponse.json({ success: true });
}
