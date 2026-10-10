import { useEffect, useState } from "react";
import {
  Button,
  Empty,
  KitPlaceholder,
  Message,
  Modal,
  dateLabel,
} from "./common";
import {
  RunnerFields,
  GroupFields,
  ProcessFields,
  MaskingFields,
  prepareProcess,
  normalizeRunner,
} from "./forms";
import {
  newRunner,
  newGroup,
  newProcess,
  newMasking,
  clone,
  references,
  move,
  targetLabel,
  maskingLabel,
  hasStock,
} from "../domain";
import { kitRepository } from "../services/repository";
import { deleteKit } from "../services/kitDeletion";
export function EntityEditor({
  editor,
  paints,
  onClose,
  setDirty,
  online,
  onNotice,
}) {
  const [draft, setDraft] = useState(() => clone(editor.value));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dirty = JSON.stringify(draft) !== JSON.stringify(editor.value);
  useEffect(() => {
    setDirty(dirty);
    return () => setDirty(false);
  }, [dirty, setDirty]);
  const { kind, kit, groupId } = editor;
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const next = clone(kit);
      const value =
        kind === "runner"
          ? normalizeRunner(draft)
          : kind === "process"
            ? prepareProcess(draft)
            : draft;
      const array =
        kind === "process"
          ? next.groups.find((g) => g.id === groupId).processes
          : next[
              { runner: "runners", group: "groups", masking: "maskings" }[kind]
            ];
      const index = array.findIndex((x) => x.id === value.id);
      if (index === -1) array.push(value);
      else array[index] = value;
      await kitRepository.save(kit.id, next, kit.revision, {
        paints,
        previous: kit,
      });
      onNotice("保存しました");
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  const Fields = {
    runner: RunnerFields,
    group: GroupFields,
    process: ProcessFields,
    masking: MaskingFields,
  }[kind];
  return (
    <Modal
      title={`${{ runner: "ランナー", group: "塗装グループ", process: "塗装工程", masking: "マスキング" }[kind]} ${editor.isNew ? "登録" : "編集"}`}
      onClose={onClose}
      busy={busy}
      dirty={dirty}
    >
      <form onSubmit={save}>
        <fieldset disabled={busy}>
          <Fields
            draft={draft}
            setDraft={setDraft}
            kit={kit}
            paints={paints}
            original={editor.isNew ? null : editor.value}
          />
        </fieldset>
        <Message error>{error}</Message>
        <div className="actions">
          <Button
            disabled={busy}
            onClick={() => {
              if (!dirty || window.confirm("未保存の入力を破棄しますか？"))
                onClose();
            }}
          >
            キャンセル
          </Button>
          <Button type="submit" tone="primary" disabled={busy || !online}>
            {busy ? "保存中…" : "保存"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function KitDetail({
  kit,
  paints,
  navigate,
  setDirty,
  online,
  onNotice,
}) {
  const [tab, setTab] = useState("plan");
  const [editor, setEditor] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const open = (kind, value, groupId) =>
    setEditor({
      kind,
      value:
        value ||
        {
          runner: newRunner,
          group: newGroup,
          process: newProcess,
          masking: newMasking,
        }[kind](),
      isNew: !value,
      groupId,
      kit: clone(kit),
    });
  const mutate = async (next) => {
    setBusy(true);
    setError("");
    try {
      await kitRepository.save(kit.id, next, kit.revision, {
        paints,
        previous: kit,
      });
      onNotice("保存しました");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const remove = (kind, item, groupId) => {
    const refs = references(kit, kind, item.id);
    if (refs.length) {
      setError(
        `参照中のため削除できません：${refs.join("、")}。先に参照元を変更してください。`,
      );
      return;
    }
    if (
      !window.confirm(
        `「${item.name || item.symbol || item.location}」を削除しますか？${kind === "group" ? "グループ内の工程も削除されます。" : ""}`,
      )
    )
      return;
    const next = clone(kit);
    if (kind === "process") {
      const group = next.groups.find((g) => g.id === groupId);
      group.processes = group.processes.filter((p) => p.id !== item.id);
    } else {
      const key = { runner: "runners", group: "groups", masking: "maskings" }[
        kind
      ];
      next[key] = next[key].filter((x) => x.id !== item.id);
    }
    mutate(next);
  };
  const performDelete = async () => {
    if (
      kit.status !== "deleting" &&
      !window.confirm(
        `「${kit.name}」とランナー・グループ・工程・マスキングをすべて削除しますか？塗料台帳は保持します。`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await deleteKit(kit);
      navigate("/");
      onNotice("キットを削除しました");
    } catch (e) {
      setError(
        `削除に失敗しました：${e.message}。削除処理中の場合は再試行してください。`,
      );
    } finally {
      setBusy(false);
    }
  };
  const maskingNotice = (masks) =>
    masks.length ? (
      <aside className="masking-notice">
        <strong>マスキングを忘れずに</strong>
        {masks.map((m) => (
          <div key={m.id}>
            <p>
              {maskingLabel(kit, m)} — {m.location}
            </p>
            <Button onClick={() => setTab("masking")}>マスキング詳細</Button>
          </div>
        ))}
      </aside>
    ) : null;
  const itemActions = (kind, item, groupId) => (
    <div className="actions">
      <Button
        disabled={busy || !online}
        onClick={() => open(kind, item, groupId)}
      >
        編集
      </Button>
      <Button
        tone="danger"
        disabled={busy || !online}
        onClick={() => remove(kind, item, groupId)}
      >
        削除
      </Button>
    </div>
  );
  return (
    <>
      <Button onClick={() => navigate("/")}>← キット一覧</Button>
      <section className="kit-header">
        <KitPlaceholder large />
        <div>
          <span className="eyebrow">{kit.series || "PAINTING PLAN"}</span>
          <h1>{kit.name}</h1>
          <p className="pre">{kit.memo}</p>
          <p className="muted">更新日 {dateLabel(kit.updatedAt)}</p>
          <div className="actions">
            <Button
              disabled={kit.status === "deleting"}
              onClick={() => navigate(`/kits/${kit.id}/edit`)}
            >
              キット編集
            </Button>
            <Button
              tone="danger"
              disabled={busy || !online}
              onClick={performDelete}
            >
              {kit.status === "deleting" ? "削除を再試行" : "キット削除"}
            </Button>
          </div>
        </div>
      </section>
      <Message error>{error}</Message>
      {kit.status === "deleting" ? (
        <Message>
          削除処理中です。データの削除を再試行してください。このキットは編集できません。
        </Message>
      ) : (
        <>
          <div className="tabs" role="tablist" aria-label="キット詳細">
            {[
              ["plan", "塗装計画"],
              ["runners", "ランナー"],
              ["masking", "マスキング"],
            ].map(([key, label]) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                aria-controls={`panel-${key}`}
                id={`tab-${key}`}
                tabIndex={tab === key ? 0 : -1}
                onKeyDown={(e) => {
                  if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
                    e.preventDefault();
                    const keys = ["plan", "runners", "masking"];
                    const next =
                      keys[
                        (keys.indexOf(tab) + (e.key === "ArrowRight" ? 1 : 2)) %
                          3
                      ];
                    setTab(next);
                    document.getElementById(`tab-${next}`).focus();
                  }
                }}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <div
            role="tabpanel"
            id={`panel-${tab}`}
            aria-labelledby={`tab-${tab}`}
          >
            {tab === "plan" && (
              <>
                <div className="section-heading">
                  <h2>
                    塗装計画 <span className="count">{kit.groups.length}</span>
                  </h2>
                  <Button
                    tone="primary"
                    disabled={busy || !online || kit.groups.length >= 100}
                    onClick={() => open("group")}
                  >
                    ＋ 塗装グループ
                  </Button>
                </div>
                {maskingNotice(kit.maskings.filter((m) => !m.groupId))}
                {!kit.groups.length && (
                  <Empty>
                    ランナーを登録して、塗装グループを作成しましょう。
                  </Empty>
                )}
                {kit.groups.map((g) => (
                  <article className="panel" key={g.id}>
                    <div className="heading">
                      <h2>{g.name}</h2>
                      <span className="badge">{g.resultColor}</span>
                    </div>
                    <div className="chips">
                      {g.targets.map((t) => (
                        <span
                          key={`${t.runnerId}/${t.colorId}`}
                          className="chip"
                        >
                          {targetLabel(kit, t)}
                        </span>
                      ))}
                    </div>
                    <p className="pre">{g.memo}</p>
                    {itemActions("group", g)}
                    {maskingNotice(
                      kit.maskings.filter(
                        (m) => m.groupId === g.id && !m.beforeProcessId,
                      ),
                    )}
                    <h3>塗装工程</h3>
                    {!g.processes.length && (
                      <p className="muted">工程未登録・計画途中</p>
                    )}
                    {g.processes.map((p, index) => (
                      <div key={p.id}>
                        {maskingNotice(
                          kit.maskings.filter(
                            (m) =>
                              m.groupId === g.id && m.beforeProcessId === p.id,
                          ),
                        )}
                        <section className="process">
                          <div className="heading">
                            <h3>
                              <span className="step">{index + 1}</span>
                              {p.name}
                            </h3>
                            <span>{p.type}</span>
                          </div>
                          <p className="muted">
                            {p.method || "塗装方法未指定"}
                          </p>
                          <ul className="paint-usages">
                            {p.paintUsages.map((u) => {
                              const paint = paints.find(
                                (x) => x.id === u.paintId,
                              );
                              return (
                                <li key={u.paintId}>
                                  <span>
                                    {paint?.name || "塗料情報を取得できません"}
                                    {paint?.archived && (
                                      <small>（台帳で削除済み）</small>
                                    )}
                                    {paint && !hasStock(paint) && (
                                      <small>（在庫なし）</small>
                                    )}
                                  </span>
                                  <strong>{u.ratioTenths / 10}%</strong>
                                </li>
                              );
                            })}
                          </ul>
                          <p className="pre">{p.memo}</p>
                          <div className="actions">
                            <Button
                              aria-label={`${p.name}を上へ`}
                              disabled={index === 0 || busy || !online}
                              onClick={() => {
                                const next = clone(kit);
                                next.groups.find(
                                  (x) => x.id === g.id,
                                ).processes = move(g.processes, index, -1);
                                mutate(next);
                              }}
                            >
                              ↑ 上へ
                            </Button>
                            <Button
                              aria-label={`${p.name}を下へ`}
                              disabled={
                                index === g.processes.length - 1 ||
                                busy ||
                                !online
                              }
                              onClick={() => {
                                const next = clone(kit);
                                next.groups.find(
                                  (x) => x.id === g.id,
                                ).processes = move(g.processes, index, 1);
                                mutate(next);
                              }}
                            >
                              ↓ 下へ
                            </Button>
                          </div>
                          {itemActions("process", p, g.id)}
                        </section>
                      </div>
                    ))}
                    <Button
                      disabled={busy || !online || g.processes.length >= 20}
                      onClick={() => open("process", null, g.id)}
                    >
                      ＋ 塗装工程
                    </Button>
                  </article>
                ))}
              </>
            )}
            {tab === "runners" && (
              <>
                <div className="section-heading">
                  <h2>
                    ランナー <span className="count">{kit.runners.length}</span>
                  </h2>
                  <Button
                    tone="primary"
                    disabled={busy || !online || kit.runners.length >= 100}
                    onClick={() => open("runner")}
                  >
                    ＋ ランナー
                  </Button>
                </div>
                {!kit.runners.length && (
                  <Empty>キットのランナーと成形色を登録しましょう。</Empty>
                )}
                {kit.runners.map((r) => (
                  <article className="panel" key={r.id}>
                    <div className="heading">
                      <h2>{r.symbol}ランナー</h2>
                      <span className="badge">
                        色プラ：{r.colors.length > 1 ? "あり" : "なし"}
                      </span>
                    </div>
                    {r.colors.map((c) => {
                      const groups = kit.groups.filter((g) =>
                        g.targets.some(
                          (t) => t.runnerId === r.id && t.colorId === c.id,
                        ),
                      );
                      return (
                        <div className="runner-color" key={c.id}>
                          <strong>{c.name}</strong>
                          <span>
                            {groups.length
                              ? groups.map((g) => g.name).join(" / ")
                              : "塗装計画未登録"}
                          </span>
                        </div>
                      );
                    })}
                    <p className="pre">{r.memo}</p>
                    {itemActions("runner", r)}
                  </article>
                ))}
              </>
            )}
            {tab === "masking" && (
              <>
                <div className="section-heading">
                  <h2>
                    マスキング{" "}
                    <span className="count">{kit.maskings.length}</span>
                  </h2>
                  <Button
                    tone="primary"
                    disabled={busy || !online || kit.maskings.length >= 200}
                    onClick={() => open("masking")}
                  >
                    ＋ マスキング
                  </Button>
                </div>
                {!kit.maskings.length && (
                  <Empty>
                    マスキングが必要な箇所を登録できます。パーツ番号は任意です。
                  </Empty>
                )}
                {kit.maskings.map((m) => {
                  const group = kit.groups.find((g) => g.id === m.groupId);
                  return (
                    <article className="panel" key={m.id}>
                      <h2>{maskingLabel(kit, m)}</h2>
                      <p>{m.bodyArea}</p>
                      <p className="pre">
                        <strong>{m.location}</strong>
                      </p>
                      <p className="muted">
                        {group
                          ? `${group.name} / ${group.processes.find((p) => p.id === m.beforeProcessId)?.name || "グループの先頭"}`
                          : "キット共通"}
                      </p>
                      {m.procedure && (
                        <>
                          <h3>手順</h3>
                          <p className="pre">{m.procedure}</p>
                        </>
                      )}
                      <p className="pre">{m.memo}</p>
                      {itemActions("masking", m)}
                    </article>
                  );
                })}
              </>
            )}
          </div>
        </>
      )}
      {editor && (
        <EntityEditor
          editor={editor}
          paints={paints}
          onClose={() => setEditor(null)}
          setDirty={setDirty}
          online={online}
          onNotice={onNotice}
        />
      )}
    </>
  );
}
