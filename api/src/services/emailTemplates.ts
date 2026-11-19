import { z } from "zod";

export const emailTemplateSchema = z.object({
  subject: z.string().trim().min(1).max(200).regex(/^[^\r\n]+$/, "Тема должна быть в одну строку"),
  body: z.string().trim().min(1).max(15000),
  buttonText: z.string().trim().max(80),
  footer: z.string().trim().max(1000),
}).strict();
export type EmailTemplate = z.infer<typeof emailTemplateSchema>;
const common = ["name", "order_number", "total", "items", "payment_instructions"];
const definition = (title: string, variables: string[], button: boolean, subject: string, body: string, buttonText = "", footer = "") =>
  ({ title, variables, button, defaults: { subject, body, buttonText, footer } });
const orderFooter = "Вы получили это письмо, потому что оформили заказ на аромазон.рф.";
export const EMAIL_TEMPLATES = {
  order_confirmation: definition("Заказ принят — покупателю", common, true,
    "Заказ № {{order_number}} принят — Аромазон-тут",
    "Здравствуйте, {{name}}!\n\nВаш заказ № {{order_number}} принят.\n\n{{items}}\n\nК предоплате: {{total}} ₽.\n\n{{payment_instructions}}", "Открыть заказ", orderFooter),
  order_collecting: definition("Заказ ожидает выкупа", common, true, "Заказ № {{order_number}} ожидает выкупа — Аромазон-тут",
    "Здравствуйте, {{name}}!\n\nВаш заказ № {{order_number}} ожидает выкупа.", "Открыть заказ", orderFooter),
  order_paid: definition("Оплата подтверждена", common, true, "Оплата заказа № {{order_number}} подтверждена — Аромазон-тут",
    "Здравствуйте, {{name}}!\n\nОплата заказа № {{order_number}} подтверждена. Спасибо!", "Открыть заказ", orderFooter),
  order_transit: definition("Заказ в пути", common, true, "Заказ № {{order_number}} в пути — Аромазон-тут",
    "Здравствуйте, {{name}}!\n\nВаш заказ № {{order_number}} в пути.", "Открыть заказ", orderFooter),
  order_delivered: definition("Заказ доставлен", common, true, "Заказ № {{order_number}} доставлен — Аромазон-тут",
    "Здравствуйте, {{name}}!\n\nВаш заказ № {{order_number}} доставлен. Спасибо за покупку!", "Открыть заказ", orderFooter),
  order_cancelled: definition("Заказ отменён", [...common, "cancellation_reason"], true, "Заказ № {{order_number}} отменён — Аромазон-тут",
    "Здравствуйте, {{name}}!\n\nВаш заказ № {{order_number}} отменён.\n\nПричина отмены:\n{{cancellation_reason}}\n\nЕсли у вас есть вопросы, свяжитесь с нами.", "Подробнее о заказе", orderFooter),
  order_tracking: definition("Отслеживание заказа", [...common, "tracking"], true, "Отслеживание заказа № {{order_number}} — Аромазон-тут",
    "Здравствуйте, {{name}}!\n\nДля заказа № {{order_number}} добавлено отслеживание:\n{{tracking}}", "Отследить посылку", orderFooter),
  admin_new_order: definition("Новый заказ — магазину", [...common, "email"], true, "Новый заказ № {{order_number}} — Аромазон-тут",
    "Заказ № {{order_number}}\nПокупатель: {{name}}\nEmail: {{email}}\nСумма: {{total}} ₽\n\n{{items}}", "Открыть в админке"),
  admin_payment_marked: definition("Покупатель отметил оплату — магазину", [...common, "email"], true,
    "Отмечена оплата заказа № {{order_number}} — Аромазон-тут",
    "Покупатель {{name}} отметил оплату заказа № {{order_number}}.\n\nПроверьте поступление {{total}} ₽ и подтвердите оплату в админке.", "Проверить заказ"),
  password_reset: definition("Восстановление пароля", ["name"], true, "Восстановление пароля — Аромазон-тут",
    "Здравствуйте, {{name}}!\n\nЧтобы задать новый пароль, нажмите кнопку ниже.\n\nСсылка действует 30 минут и используется один раз. Если вы не запрашивали восстановление, проигнорируйте письмо.", "Задать новый пароль",
    "Вы получили это письмо в ответ на запрос восстановления пароля на аромазон.рф."),
  password_changed: definition("Пароль изменён", ["name"], true, "Пароль изменён — Аромазон-тут",
    "Здравствуйте, {{name}}!\n\nПароль вашего аккаунта изменён. Войдите с новым паролем.\n\nЕсли вы этого не делали, восстановите пароль и свяжитесь с нами.", "Войти в аккаунт"),
  contact: definition("Обращение с сайта — магазину", ["name", "email", "message"], false, "Новое обращение с сайта — Аромазон-тут",
    "Имя: {{name}}\nEmail: {{email}}\n\n{{message}}"),
} as const;
export type EmailTemplateKey = keyof typeof EMAIL_TEMPLATES;
export function isEmailTemplateKey(key: string): key is EmailTemplateKey { return Object.hasOwn(EMAIL_TEMPLATES, key); }
export function validateEmailTemplate(key: EmailTemplateKey, value: unknown): EmailTemplate {
  const template = emailTemplateSchema.parse(value);
  const definition = EMAIL_TEMPLATES[key];
  if (definition.button && !template.buttonText) throw new Error("Укажите текст кнопки");
  for (const text of Object.values(template)) {
    if (/{{|}}/.test(text.replace(/{{.*?}}/gs, ""))) throw new Error("Проверьте скобки подстановок: {{name}}");
    for (const match of text.matchAll(/{{(.*?)}}/gs)) {
      if (!definition.variables.includes(match[1]!.trim())) throw new Error(`Неизвестная подстановка: ${match[0]}`);
    }
  }
  return template;
}
export const shortOrderNumber = (id: string) => id.slice(0, 8);
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export function safeEmailUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : undefined; } catch { return undefined; }
}
export function renderEmailTemplate(template: EmailTemplate, variables: Record<string, string>, actionUrl?: string) {
  const substitute = (text: string) => text.replace(/{{\s*(\w+)\s*}}/g, (_, key: string) => variables[key] ?? "");
  const subject = substitute(template.subject).replace(/[\r\n]+/g, " ");
  const body = substitute(template.body);
  const footer = substitute(template.footer);
  const buttonText = substitute(template.buttonText);
  const url = safeEmailUrl(actionUrl);
  const action = url && buttonText ? `\n\n${buttonText}: ${url}` : "";
  const text = `${body}${action}\n\nАромазон-тут\n${process.env.CONTACT_EMAIL ?? "aromazone.tut@gmail.com"}${footer ? `\n\n${footer}` : ""}`;
  const paragraphs = escapeHtml(body).split(/\n\s*\n/).map(p => `<p style="margin:0 0 18px;line-height:1.65;overflow-wrap:anywhere">${p.replace(/\n/g, "<br>")}</p>`).join("");
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f4ef;color:#262c25;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e3e5dc;border-radius:16px">
<tr><td style="padding:28px 28px 20px;border-bottom:1px solid #e3e5dc"><span style="font-size:23px;font-weight:bold;color:#34513b">Аромазон-тут</span><br><span style="font-size:13px;color:#697264">Совместные покупки из Франции</span></td></tr>
<tr><td style="padding:28px;font-size:16px">${paragraphs}${url && buttonText ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0"><tr><td bgcolor="#34513b" style="border-radius:8px;mso-padding-alt:15px 24px"><a href="${escapeHtml(url)}" target="_blank" style="display:inline-block;padding:15px 24px;border:1px solid #34513b;border-radius:8px;color:#ffffff;background:#34513b;font-size:16px;font-weight:bold;text-decoration:none">${escapeHtml(buttonText)}</a></td></tr></table><p style="font-size:12px;line-height:1.6;color:#697264;overflow-wrap:anywhere">Если кнопка не работает, откройте ссылку:<br><a href="${escapeHtml(url)}" style="color:#34513b;word-break:break-all">${escapeHtml(url)}</a></p>` : ""}</td></tr>
<tr><td style="padding:22px 28px;border-top:1px solid #e3e5dc;font-size:13px;line-height:1.6;color:#697264">Аромазон-тут<br>Есть вопросы? ${escapeHtml(process.env.CONTACT_EMAIL ?? "aromazone.tut@gmail.com")}${footer ? `<p style="margin:14px 0 0">${escapeHtml(footer).replace(/\n/g,"<br>")}</p>` : ""}</td></tr></table></td></tr></table></body></html>`;
  return { subject, body: text, html };
}
export const PREVIEW_VARIABLES: Record<string, string> = {
  cancellation_reason: "Товар закончился у поставщика. Напишите нам для согласования дальнейших действий.",
  name: "Алексей", order_number: "4bb1e295", total: "987", email: "buyer@example.com",
  items: "— Сыворотка для контура глаз, 15 мл × 1", payment_instructions: "Откройте заказ и нажмите «Оплатить». После перевода отметьте «Я оплатил».",
  tracking: "https://www.cdek.ru/ru/tracking/", message: "Здравствуйте! Подскажите, когда будет отправлен заказ?",
};
