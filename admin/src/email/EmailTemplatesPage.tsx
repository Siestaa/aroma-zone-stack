import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import styles from "./EmailTemplatesPage.module.css";

type Template = { subject: string; body: string; buttonText: string; footer: string };
type Definition = { key: string; title: string; variables: string[]; button: boolean; defaults: Template; template: Template };
type Preview = { subject: string; body: string; html: string };
const descriptions: Record<string, string> = {
  cancellation_reason: "Причина отмены заказа", name: "Имя покупателя", order_number: "Короткий номер заказа", total: "Сумма в рублях", items: "Состав заказа",
  payment_instructions: "Инструкция по оплате для покупателя или гостя", email: "Email покупателя", tracking: "Данные отслеживания", message: "Текст обращения",
};

export function EmailTemplatesPage() {
  const query = useQuery({ queryKey: ["admin-email-templates"], queryFn: () => api.get<Definition[]>("/settings/email-templates") });
  const [selected, setSelected] = useState("order_confirmation");
  const [dirty, setDirty] = useState(false);
  const current = query.data?.find(item => item.key === selected);
  return <section className={styles.page}>
    <header><h1>Письма</h1><p>Настройте сообщения покупателям и уведомления магазину. Изменения применяются к новым письмам после сохранения.</p></header>
    {query.isPending ? <p role="status">Загрузка шаблонов…</p> : query.isError ? <div role="alert"><p>Не удалось загрузить шаблоны.</p><button type="button" onClick={() => query.refetch()}>Повторить</button></div> : <>
      <div className={styles.selector}><label htmlFor="email-template">Тип письма</label>
        <select id="email-template" name="template" value={selected} onChange={event => {
          if (dirty && !window.confirm("Перейти к другому письму? Несохранённые изменения будут потеряны.")) return;
          setSelected(event.target.value); setDirty(false);
        }}>{query.data.map(item => <option key={item.key} value={item.key}>{item.title}</option>)}</select>
      </div>
      {current && <TemplateEditor key={current.key} definition={current} onDirty={setDirty} />}
    </>}
  </section>;
}
function TemplateEditor({ definition, onDirty }: { definition: Definition; onDirty: (dirty: boolean) => void }) {
  const queryClient = useQueryClient();
  const form = useRef<HTMLFormElement>(null);
  const errorSummary = useRef<HTMLParagraphElement>(null);
  const [draft, setDraft] = useState(definition.template);
  const [saved, setSaved] = useState(definition.template);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const changed = (value: Template) => {
    setDraft(value); setNotice(""); setError(""); setPreview(null);
    onDirty(JSON.stringify(value) !== JSON.stringify(saved));
  };
  const failed = (err: Error) => { setError(err.message || "Не удалось выполнить запрос"); requestAnimationFrame(() => errorSummary.current?.focus()); };
  const save = useMutation({
    mutationFn: (value: Template) => api.patch<Template>(`/settings/email-templates/${definition.key}`, value),
    onSuccess: (value) => {
      setDraft(value); setSaved(value); onDirty(false); setNotice("Шаблон сохранён");
      queryClient.setQueryData<Definition[]>(["admin-email-templates"], items => items?.map(item => item.key === definition.key ? { ...item, template: value } : item));
    }, onError: failed,
  });
  const renderPreview = useMutation({
    mutationFn: (value: Template) => api.post<Preview>(`/settings/email-templates/${definition.key}/preview`, value),
    onSuccess: setPreview, onError: failed,
  });
  const busy = save.isPending || renderPreview.isPending;
  return <div className={styles.columns}>
    <form ref={form} aria-labelledby="template-heading" method="post" onSubmit={event => { event.preventDefault(); setError(""); setNotice(""); save.mutate(draft); }} className={styles.card}>
      <h2 id="template-heading">{definition.title}</h2>
      <fieldset disabled={busy} className={styles.fields}>
        <legend className={styles.visuallyHidden}>Содержимое шаблона</legend>
        <div className={styles.field}><label htmlFor="email-subject">Тема письма *</label><input id="email-subject" name="subject" required maxLength={200} value={draft.subject} onChange={event => changed({ ...draft, subject: event.target.value })} /></div>
        <div className={styles.field}><label htmlFor="email-body">Текст письма *</label><textarea id="email-body" name="body" required maxLength={15000} rows={12} aria-describedby="template-variables" value={draft.body} onChange={event => changed({ ...draft, body: event.target.value })} /></div>
        {definition.button && <div className={styles.field}><label htmlFor="email-button">Текст кнопки *</label><input id="email-button" name="buttonText" required maxLength={80} value={draft.buttonText} onChange={event => changed({ ...draft, buttonText: event.target.value })} /><small>Ссылка подставляется автоматически для этого письма.</small></div>}
        <div className={styles.field}><label htmlFor="email-footer">Примечание внизу письма</label><textarea id="email-footer" name="footer" maxLength={1000} rows={3} value={draft.footer} onChange={event => changed({ ...draft, footer: event.target.value })} /></div>
      </fieldset>
      <details id="template-variables" className={styles.variables}><summary>Доступные подстановки</summary><ul>{definition.variables.map(variable => <li key={variable}><code>{`{{${variable}}}`}</code> — {descriptions[variable]}</li>)}</ul><p>Используйте подстановки в теме, тексте или подписи кнопки. HTML вводить не нужно.</p></details>
      <p ref={errorSummary} tabIndex={-1} role="alert" className={styles.error}>{error}</p>
      <div className={styles.actions}>
        <button type="submit" disabled={busy} className={styles.primary}>{save.isPending ? "Сохранение…" : "Сохранить шаблон"}</button>
        <button type="button" disabled={busy} onClick={() => { if (form.current?.reportValidity()) { setError(""); renderPreview.mutate(draft); } }}>{renderPreview.isPending ? "Подготовка…" : "Предпросмотр"}</button>
        <button type="button" disabled={busy} onClick={() => changed({ ...definition.defaults })}>Вернуть исходный текст</button>
      </div>
      <p role="status" className={styles.notice}>{notice}</p>
    </form>
    <section className={styles.card} aria-labelledby="preview-heading"><h2 id="preview-heading">Предпросмотр письма</h2>
      {preview ? <><p className={styles.subject}>{preview.subject}</p><iframe title="Пример письма покупателю" sandbox="" referrerPolicy="no-referrer" srcDoc={preview.html} className={styles.preview} /><details className={styles.variables}><summary>Текстовая версия</summary><pre className={styles.plaintext}>{preview.body}</pre></details></> : <p className={styles.help}>Нажмите «Предпросмотр», чтобы увидеть письмо с примером заказа. Тестовое письмо при этом не отправляется.</p>}
    </section>
  </div>;
}
