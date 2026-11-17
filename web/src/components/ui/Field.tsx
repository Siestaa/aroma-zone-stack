import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import styles from "./Field.module.css";

type CommonProps = {
  label: string;
  error?: string;
  note?: ReactNode;
};

type InputFieldProps = CommonProps &
  InputHTMLAttributes<HTMLInputElement> & { as?: "input" };
type TextareaFieldProps = CommonProps &
  TextareaHTMLAttributes<HTMLTextAreaElement> & { as: "textarea" };

export const Field = forwardRef<HTMLInputElement | HTMLTextAreaElement, InputFieldProps | TextareaFieldProps>(
  function Field({ label, error, note, as = "input", id, ...rest }, ref) {
    const fieldId = id ?? rest.name;

    return (
      <div className={styles.field}>
        <label htmlFor={fieldId} className={styles.label}>
          {label}
        </label>
        {as === "textarea" ? (
          <textarea
            id={fieldId}
            ref={ref as React.Ref<HTMLTextAreaElement>}
            className={styles.input}
            data-error={Boolean(error)}
            {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)}
          />
        ) : (
          <input
            id={fieldId}
            ref={ref as React.Ref<HTMLInputElement>}
            className={styles.input}
            data-error={Boolean(error)}
            {...(rest as InputHTMLAttributes<HTMLInputElement>)}
          />
        )}
        {note && !error && <span className={styles.note}>{note}</span>}
        {error && (
          <span className={styles.error} role="alert">
            {error}
          </span>
        )}
      </div>
    );
  },
);
