import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { settings } from "../db/schema.js";
import { EMAIL_TEMPLATES, validateEmailTemplate, type EmailTemplateKey, type EmailTemplate } from "./emailTemplates.js";
export type EmailConnection = Pick<typeof db, "select" | "insert">;
const settingsKey = (key: EmailTemplateKey) => `email_template_${key}`;
export async function getEmailTemplate(key: EmailTemplateKey, connection: EmailConnection = db): Promise<EmailTemplate> {
  const [row] = await connection.select().from(settings).where(eq(settings.key, settingsKey(key)));
  if (row) {
    try { return validateEmailTemplate(key, row.value); } catch { /* Use working defaults for invalid legacy values. */ }
  }
  return { ...EMAIL_TEMPLATES[key].defaults };
}
export async function listEmailTemplates() {
  return Promise.all((Object.keys(EMAIL_TEMPLATES) as EmailTemplateKey[]).map(async key => ({
    key, ...EMAIL_TEMPLATES[key], template: await getEmailTemplate(key),
  })));
}
export async function saveEmailTemplate(key: EmailTemplateKey, value: unknown) {
  const template = validateEmailTemplate(key, value);
  await db.insert(settings).values({ key: settingsKey(key), value: template }).onConflictDoUpdate({ target: settings.key, set: { value: template } });
  return template;
}
