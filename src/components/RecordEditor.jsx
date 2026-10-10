import { useEffect, useState } from "react";
import { Button, Message } from "./common";
import { KitFields, PaintFields } from "./forms";
import { clone, uuid, newKit, newPaint } from "../domain";
import { kitRepository, paintRepository } from "../services/repository";
export function RecordEditor({
  kind,
  record,
  paints,
  navigate,
  setDirty,
  online,
  onNotice,
}) {
  const [original] = useState(() => (record ? clone(record) : null));
  const [id] = useState(() => record?.id || uuid());
  const [draft, setDraft] = useState(
    () => original || (kind === "kit" ? newKit() : newPaint()),
  );
  const [initial] = useState(() => JSON.stringify(draft));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dirty = JSON.stringify(draft) !== initial;
  useEffect(() => {
    setDirty(dirty);
    return () => setDirty(false);
  }, [dirty, setDirty]);
  const destination =
    kind === "kit" ? (original ? `/kits/${id}` : "/") : "/paints";
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (kind === "kit")
        await kitRepository.save(id, draft, original?.revision, {
          paints,
          previous: original,
        });
      else await paintRepository.save(id, draft, original?.revision);
      setDirty(false);
      onNotice("保存しました");
      navigate(kind === "kit" ? `/kits/${id}` : "/paints", true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="editor-page">
      <span className="eyebrow">
        {kind === "kit" ? "KIT" : "PAINT LIBRARY"}
      </span>
      <h1>
        {kind === "kit" ? "キット" : "保有塗料"}
        {original ? "編集" : "登録"}
      </h1>
      <form onSubmit={save}>
        <fieldset disabled={busy}>
          {kind === "kit" ? (
            <KitFields draft={draft} setDraft={setDraft} />
          ) : (
            <PaintFields draft={draft} setDraft={setDraft} paints={paints} />
          )}
        </fieldset>
        <Message error>{error}</Message>
        <div className="actions">
          <Button disabled={busy} onClick={() => navigate(destination)}>
            キャンセル
          </Button>
          <Button type="submit" tone="primary" disabled={busy || !online}>
            {busy ? "保存中…" : original ? "変更を保存" : "登録"}
          </Button>
        </div>
      </form>
    </section>
  );
}
