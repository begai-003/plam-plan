import { cloneElement, useEffect, useId, useRef, useState } from "react";
export function Button({ children, tone = "", ...props }) {
  return (
    <button className={`button ${tone}`} type="button" {...props}>
      {children}
    </button>
  );
}
export function Field({ label, children, ...props }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children ? cloneElement(children, { id }) : <input id={id} {...props} />}
    </div>
  );
}
export function Memo({ value, onChange, label = "メモ" }) {
  return (
    <Field label={label}>
      <textarea
        rows={3}
        maxLength={2000}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}
export function Message({ children, error = false }) {
  return children ? (
    <div
      role={error ? "alert" : "status"}
      className={`message ${error ? "error" : ""}`}
    >
      {children}
    </div>
  ) : null;
}
export function Empty({ children }) {
  return (
    <div className="empty">
      <span className="empty-symbol" aria-hidden="true">
        ＋
      </span>
      <p>{children}</p>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  busy = false,
  dirty = false,
}) {
  const dialog = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const opener = useRef(document.activeElement);
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => {
      element.close();
      opener.current?.focus();
    };
  }, []);
  const close = () => {
    if (!busy && (!dirty || window.confirm("未保存の入力を破棄しますか？")))
      closeRef.current();
  };
  return (
    <dialog
      ref={dialog}
      aria-labelledby="modal-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === dialog.current) close();
      }}
    >
      <div className="modal-content">
        <div className="heading">
          <h2 id="modal-title">{title}</h2>
          <Button aria-label="閉じる" disabled={busy} onClick={close}>
            ×
          </Button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
export function KitPlaceholder({ large = false }) {
  return (
    <div
      className={`kit-placeholder ${large ? "large" : ""}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 80 80">
        <path
          d="M17 19h46v42H17zM27 19v42M53 19v42M17 30h46M17 50h46M33 36h14v9H33z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}
export const dateLabel = (value) =>
  value?.toDate ? value.toDate().toLocaleDateString("ja-JP") : "保存中";
