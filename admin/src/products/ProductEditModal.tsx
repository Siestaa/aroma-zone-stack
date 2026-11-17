import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { AdminProduct } from "../lib/types";
import styles from "./ProductEditModal.module.css";

export function ProductEditModal({ product, onClose }: { product: AdminProduct; onClose: () => void }) {
  const [nameRu, setNameRu] = useState(product.nameRu ?? "");
  const [descriptionRu, setDescriptionRu] = useState(product.descriptionRu ?? "");
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: () =>
      api.patch(`/products/${product.id}`, {
        nameRu: nameRu.trim() || null,
        descriptionRu: descriptionRu.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      onClose();
    },
  });

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>{product.nameRu || product.name}</h2>
        <p className={styles.nameFr}>Оригинал (FR): {product.name}</p>

        <div className={styles.field}>
          <label htmlFor="nameRu">Название (RU)</label>
          <input id="nameRu" value={nameRu} onChange={(e) => setNameRu(e.target.value)} />
        </div>

        <div className={styles.field}>
          <label htmlFor="descriptionRu">Описание (RU)</label>
          <div className={styles.sourceText}>{product.description || "— нет французского описания —"}</div>
          <textarea
            id="descriptionRu"
            rows={6}
            value={descriptionRu}
            onChange={(e) => setDescriptionRu(e.target.value)}
          />
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.cancelButton} onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className={styles.saveButton}
            disabled={save.isPending || !nameRu.trim()}
            onClick={() => save.mutate()}
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
