import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { ContactsPageContent, InfoPageBlock, InfoPageContent, InfoPageSlug, ProductPageNoteContent } from "../lib/types";
import styles from "./InfoPagesPage.module.css";

const TABS: { slug: InfoPageSlug; label: string }[] = [
  { slug: "about", label: "О нас" },
  { slug: "delivery", label: "Доставка" },
  { slug: "payment", label: "Оплата" },
];

// Static info pages (about/delivery/payment/contacts) — see
// api/src/services/infoPagesService.ts for the backing content model.
export function InfoPagesPage() {
  const [activeTab, setActiveTab] = useState<InfoPageSlug | "contacts" | "product-note">("about");

  return (
    <div>
      <div className={styles.tabs}>
        {TABS.map((t) => (
          <button
            key={t.slug}
            type="button"
            className={`${styles.tab} ${activeTab === t.slug ? styles.tabActive : ""}`}
            onClick={() => setActiveTab(t.slug)}
          >
            {t.label}
          </button>
        ))}
        <button
          type="button"
          className={`${styles.tab} ${activeTab === "contacts" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("contacts")}
        >
          Контакты
        </button>
        <button
          type="button"
          className={`${styles.tab} ${activeTab === "product-note" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("product-note")}
        >
          Карточка товара
        </button>
      </div>

      {activeTab === "contacts" ? (
        <ContactsEditor />
      ) : activeTab === "product-note" ? (
        <ProductNoteEditor />
      ) : (
        <InfoPageEditor key={activeTab} slug={activeTab} />
      )}
    </div>
  );
}

function InfoPageEditor({ slug }: { slug: InfoPageSlug }) {
  const queryClient = useQueryClient();
  const { data: config } = useQuery({
    queryKey: ["admin-page", slug],
    queryFn: () => api.get<InfoPageContent>(`/pages/${slug}`),
  });

  const [draft, setDraft] = useState<InfoPageContent | null>(null);
  const [hydratedFrom, setHydratedFrom] = useState<InfoPageContent | null>(null);
  useEffect(() => {
    if (config && config !== hydratedFrom) {
      setDraft(config);
      setHydratedFrom(config);
    }
  }, [config, hydratedFrom]);

  const save = useMutation({
    mutationFn: () => {
      if (!draft) throw new Error("Nothing to save yet");
      return api.put<InfoPageContent>(`/pages/${slug}`, draft);
    },
    onSuccess: (res) => {
      queryClient.setQueryData(["admin-page", slug], res);
      setDraft(res);
      setHydratedFrom(res);
    },
  });

  if (!draft) return <p className={styles.hint}>Загрузка…</p>;

  const isDirty = JSON.stringify(draft) !== JSON.stringify(hydratedFrom);

  function updateBlock(i: number, field: keyof InfoPageBlock, value: string) {
    setDraft((prev) => prev && { ...prev, blocks: prev.blocks.map((b, idx) => (idx === i ? { ...b, [field]: value } : b)) });
  }

  function moveBlock(i: number, dir: -1 | 1) {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = [...prev.blocks];
      const target = i + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[i], next[target]] = [next[target], next[i]];
      return { ...prev, blocks: next };
    });
  }

  function removeBlock(i: number) {
    setDraft((prev) => prev && { ...prev, blocks: prev.blocks.filter((_, idx) => idx !== i) });
  }

  function addBlock() {
    setDraft((prev) => prev && { ...prev, blocks: [...prev.blocks, { title: "", body: "" }] });
  }

  return (
    <section className={styles.card}>
      <div className={styles.field}>
        <label htmlFor="eyebrow">Надпись над заголовком</label>
        <input id="eyebrow" value={draft.eyebrow} onChange={(e) => setDraft({ ...draft, eyebrow: e.target.value })} />
      </div>
      <div className={styles.field}>
        <label htmlFor="title">Заголовок</label>
        <input id="title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
      </div>
      <div className={styles.field}>
        <label htmlFor="lede">Текст под заголовком</label>
        <textarea id="lede" rows={3} value={draft.lede} onChange={(e) => setDraft({ ...draft, lede: e.target.value })} />
      </div>

      <h3 className={styles.blocksTitle}>Блоки на странице</h3>
      <p className={styles.hint}>Каждый — карточка на сайте. Порядок здесь = порядок на странице.</p>
      <ol className={styles.blockList}>
        {draft.blocks.map((block, i) => (
          <li key={i} className={styles.blockRow}>
            <div className={styles.blockActions}>
              <button type="button" disabled={i === 0} onClick={() => moveBlock(i, -1)} aria-label="Выше">
                ↑
              </button>
              <button
                type="button"
                disabled={i === draft.blocks.length - 1}
                onClick={() => moveBlock(i, 1)}
                aria-label="Ниже"
              >
                ↓
              </button>
              <button type="button" onClick={() => removeBlock(i)} aria-label="Удалить">
                ✕
              </button>
            </div>
            <div className={styles.blockFields}>
              <input
                placeholder="Заголовок блока"
                value={block.title}
                onChange={(e) => updateBlock(i, "title", e.target.value)}
              />
              <textarea
                rows={3}
                placeholder="Описание"
                value={block.body}
                onChange={(e) => updateBlock(i, "body", e.target.value)}
              />
            </div>
          </li>
        ))}
      </ol>
      <button type="button" className={styles.addButton} onClick={addBlock}>
        + Добавить блок
      </button>

      {draft.note !== undefined && (
        <div className={styles.field}>
          <label htmlFor="note">Приписка внизу страницы</label>
          <textarea id="note" rows={2} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
        </div>
      )}

      <div className={styles.saveBar}>
        <button type="button" className={styles.saveButton} disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Сохранение…" : "Сохранить"}
        </button>
        {save.isSuccess && !save.isPending && !isDirty && <span className={styles.savedHint}>Сохранено</span>}
      </div>
    </section>
  );
}

// City deliberately isn't editable here — dropped from the storefront page
// entirely, not just left unedited (see infoPagesService.ts's
// ContactsPageContent comment). The VK community-card link stays hardcoded
// in web/src/app/contacts/page.tsx — only the sentence text before it is.
function ContactsEditor() {
  const queryClient = useQueryClient();
  const { data: config } = useQuery({
    queryKey: ["admin-page", "contacts"],
    queryFn: () => api.get<ContactsPageContent>("/pages/contacts"),
  });

  const [draft, setDraft] = useState<ContactsPageContent | null>(null);
  const [hydratedFrom, setHydratedFrom] = useState<ContactsPageContent | null>(null);
  useEffect(() => {
    if (config && config !== hydratedFrom) {
      setDraft(config);
      setHydratedFrom(config);
    }
  }, [config, hydratedFrom]);

  const save = useMutation({
    mutationFn: () => {
      if (!draft) throw new Error("Nothing to save yet");
      return api.put<ContactsPageContent>("/pages/contacts", draft);
    },
    onSuccess: (res) => {
      queryClient.setQueryData(["admin-page", "contacts"], res);
      setDraft(res);
      setHydratedFrom(res);
    },
  });

  if (!draft) return <p className={styles.hint}>Загрузка…</p>;

  const isDirty = JSON.stringify(draft) !== JSON.stringify(hydratedFrom);

  return (
    <section className={styles.card}>
      <div className={styles.field}>
        <label htmlFor="contact-email">Email</label>
        <input id="contact-email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
      </div>
      <div className={styles.field}>
        <label htmlFor="community-text">Текст про сообщество (перед ссылкой)</label>
        <textarea
          id="community-text"
          rows={2}
          value={draft.communityText}
          onChange={(e) => setDraft({ ...draft, communityText: e.target.value })}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="community-link-text">Текст ссылки</label>
        <input
          id="community-link-text"
          value={draft.communityLinkText}
          onChange={(e) => setDraft({ ...draft, communityLinkText: e.target.value })}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="community-link-url">Адрес ссылки</label>
        <input
          id="community-link-url"
          value={draft.communityLinkUrl}
          onChange={(e) => setDraft({ ...draft, communityLinkUrl: e.target.value })}
        />
      </div>
      <div className={styles.saveBar}>
        <button type="button" className={styles.saveButton} disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Сохранение…" : "Сохранить"}
        </button>
        {save.isSuccess && !save.isPending && !isDirty && <span className={styles.savedHint}>Сохранено</span>}
      </div>
    </section>
  );
}

// Second accordion item on every /product/[slug] page — the first
// ("Описание и применение") is the product's own real description, not
// admin content, so only this one static note is editable here (see
// api/src/services/infoPagesService.ts's ProductPageNote).
function ProductNoteEditor() {
  const queryClient = useQueryClient();
  const { data: config } = useQuery({
    queryKey: ["admin-page", "product-note"],
    queryFn: () => api.get<ProductPageNoteContent>("/pages/product-note"),
  });

  const [draft, setDraft] = useState<ProductPageNoteContent | null>(null);
  const [hydratedFrom, setHydratedFrom] = useState<ProductPageNoteContent | null>(null);
  useEffect(() => {
    if (config && config !== hydratedFrom) {
      setDraft(config);
      setHydratedFrom(config);
    }
  }, [config, hydratedFrom]);

  const save = useMutation({
    mutationFn: () => {
      if (!draft) throw new Error("Nothing to save yet");
      return api.put<ProductPageNoteContent>("/pages/product-note", draft);
    },
    onSuccess: (res) => {
      queryClient.setQueryData(["admin-page", "product-note"], res);
      setDraft(res);
      setHydratedFrom(res);
    },
  });

  if (!draft) return <p className={styles.hint}>Загрузка…</p>;

  const isDirty = JSON.stringify(draft) !== JSON.stringify(hydratedFrom);

  return (
    <section className={styles.card}>
      <p className={styles.hint}>
        Второй раскрывающийся блок на странице товара (после описания) — показывается одинаково на
        карточках всех товаров.
      </p>
      <div className={styles.field}>
        <label htmlFor="product-note-title">Заголовок блока</label>
        <input
          id="product-note-title"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="product-note-body">Текст</label>
        <textarea
          id="product-note-body"
          rows={4}
          value={draft.body}
          onChange={(e) => setDraft({ ...draft, body: e.target.value })}
        />
      </div>
      <div className={styles.saveBar}>
        <button type="button" className={styles.saveButton} disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Сохранение…" : "Сохранить"}
        </button>
        {save.isSuccess && !save.isPending && !isDirty && <span className={styles.savedHint}>Сохранено</span>}
      </div>
    </section>
  );
}
