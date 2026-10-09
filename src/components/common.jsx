import { cloneElement, useEffect, useId, useRef, useState } from "react";
import { imageRepository } from "../services/imageRepository";
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
export function KitImage({ path, name, large = false }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    let objectUrl;
    setUrl(null);
    setError(false);
    if (path)
      imageRepository
        .load(path)
        .then((value) => {
          objectUrl = value;
          if (alive) setUrl(value);
          else URL.revokeObjectURL(value);
        })
        .catch(() => {
          if (alive) setError(true);
        });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path, retry]);
  return (
    <div className={`kit-image ${large ? "large" : ""}`}>
      {url ? (
        <img src={url} alt={`${name}のキット画像`} />
      ) : error ? (
        <div>
          <p>画像を取得できません</p>
          <Button onClick={() => setRetry((x) => x + 1)}>再試行</Button>
        </div>
      ) : (
        <>
          <svg viewBox="0 0 80 80" aria-hidden="true">
            <path
              d="M17 19h46v42H17zM27 19v42M53 19v42M17 30h46M17 50h46M33 36h14v9H33z"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
          <span>{path ? "画像を読み込み中…" : "キット画像なし"}</span>
        </>
      )}
    </div>
  );
}
export const dateLabel = (value) =>
  value?.toDate ? value.toDate().toLocaleDateString("ja-JP") : "保存中";
