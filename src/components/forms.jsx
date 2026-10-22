import { useState } from "react";
import { Button, Field, Memo, Message } from "./common";
import {
  uuid,
  normalizeSymbol,
  references,
  TYPES,
  METHODS,
  ratioTenths,
  duplicatePaint,
} from "../domain";
const update = (set, key, value) =>
  set((previous) => ({ ...previous, [key]: value }));
export function KitFields({ draft, setDraft }) {
  return (
    <>
      <Field
        label="キット名（必須）"
        required
        maxLength={100}
        value={draft.name}
        onChange={(e) => update(setDraft, "name", e.target.value)}
      />
      <Field
        label="シリーズ"
        maxLength={100}
        placeholder="HG、RG、MGなど"
        value={draft.series}
        onChange={(e) => update(setDraft, "series", e.target.value)}
      />
      <Memo
        value={draft.memo}
        onChange={(value) => update(setDraft, "memo", value)}
      />
    </>
  );
}
export function RunnerFields({ draft, setDraft, kit }) {
  const [error, setError] = useState("");
  return (
    <>
      <Field
        label="ランナー記号（必須）"
        maxLength={20}
        required
        value={draft.symbol}
        onChange={(e) => update(setDraft, "symbol", e.target.value)}
      />
      <p className="muted">
        保存時に前後の空白を除去し、英字を大文字にします。
      </p>
      <fieldset>
        <legend>成形色（必須）</legend>
        <p>
          色プラ：{draft.colors.length > 1 ? "あり" : "なし"}
          （成形色の件数から判定）
        </p>
        {draft.colors.map((color, index) => (
          <div className="row" key={color.id}>
            <Field
              label={`成形色 ${index + 1}`}
              required
              maxLength={100}
              value={color.name}
              onChange={(e) =>
                update(
                  setDraft,
                  "colors",
                  draft.colors.map((c) =>
                    c.id === color.id ? { ...c, name: e.target.value } : c,
                  ),
                )
              }
            />
            <Button
              onClick={() => {
                const refs = references(kit, "color", color.id);
                if (refs.length)
                  setError(`参照中のため削除できません：${refs.join("、")}`);
                else if (
                  window.confirm(
                    `成形色「${color.name || index + 1}」を削除しますか？`,
                  )
                )
                  update(
                    setDraft,
                    "colors",
                    draft.colors.filter((c) => c.id !== color.id),
                  );
              }}
              disabled={draft.colors.length <= 1}
            >
              色削除
            </Button>
          </div>
        ))}
        <Button
          disabled={draft.colors.length >= 10}
          onClick={() =>
            update(setDraft, "colors", [
              ...draft.colors,
              { id: uuid(), name: "" },
            ])
          }
        >
          ＋ 成形色
        </Button>
      </fieldset>
      <Message error>{error}</Message>
      <Memo
        value={draft.memo}
        onChange={(value) => update(setDraft, "memo", value)}
      />
    </>
  );
}
export function GroupFields({ draft, setDraft, kit }) {
  const toggle = (target) => {
    const exists = draft.targets.some(
      (t) => t.runnerId === target.runnerId && t.colorId === target.colorId,
    );
    update(
      setDraft,
      "targets",
      exists
        ? draft.targets.filter(
            (t) =>
              !(t.runnerId === target.runnerId && t.colorId === target.colorId),
          )
        : [...draft.targets, target],
    );
  };
  return (
    <>
      <Field
        label="グループ名（必須）"
        required
        maxLength={100}
        value={draft.name}
        onChange={(e) => update(setDraft, "name", e.target.value)}
      />
      <Field
        label="塗装後の色（必須）"
        required
        maxLength={100}
        value={draft.resultColor}
        onChange={(e) => update(setDraft, "resultColor", e.target.value)}
      />
      <fieldset>
        <legend>対象ランナー・成形色（必須）</legend>
        {!kit.runners.length && <p>先にランナーを登録してください。</p>}
        {kit.runners.map((r) => (
          <div key={r.id}>
            <h3>
              {r.symbol}ランナー{r.colors.length > 1 ? "（色プラ）" : ""}
            </h3>
            {r.colors.map((c) => (
              <label className="check" key={c.id}>
                <input
                  type="checkbox"
                  checked={draft.targets.some(
                    (t) => t.runnerId === r.id && t.colorId === c.id,
                  )}
                  onChange={() => toggle({ runnerId: r.id, colorId: c.id })}
                />
                {c.name}
              </label>
            ))}
          </div>
        ))}
      </fieldset>
      <Memo
        value={draft.memo}
        onChange={(value) => update(setDraft, "memo", value)}
      />
    </>
  );
}
export function ProcessFields({ draft, setDraft, paints, original }) {
  const choices = paints.filter(
    (p) => !p.archived || original?.paintUsages.some((u) => u.paintId === p.id),
  );
  return (
    <>
      <Field
        label="工程名（必須）"
        required
        maxLength={100}
        value={draft.name}
        onChange={(e) => update(setDraft, "name", e.target.value)}
      />
      <Field label="工程種別（必須）">
        <select
          value={draft.type}
          onChange={(e) => update(setDraft, "type", e.target.value)}
        >
          {TYPES.map((type) => (
            <option key={type}>{type}</option>
          ))}
        </select>
      </Field>
      <Field label="塗装方法">
        <select
          value={draft.method}
          onChange={(e) => update(setDraft, "method", e.target.value)}
        >
          {METHODS.map((method) => (
            <option key={method} value={method}>
              {method || "未指定"}
            </option>
          ))}
        </select>
      </Field>
      <fieldset>
        <legend>使用塗料・配合比率（必須）</legend>
        {draft.paintUsages.map((u, index) => (
          <div key={index} className="usage-row">
            <Field label={`塗料 ${index + 1}`}>
              <select
                required
                value={u.paintId}
                onChange={(e) =>
                  update(
                    setDraft,
                    "paintUsages",
                    draft.paintUsages.map((x, i) =>
                      i === index ? { ...x, paintId: e.target.value } : x,
                    ),
                  )
                }
              >
                <option value="">選択してください</option>
                {choices.map((p) => (
                  <option
                    key={p.id}
                    value={p.id}
                    disabled={
                      p.archived &&
                      !original?.paintUsages.some((x) => x.paintId === p.id)
                    }
                  >
                    {p.manufacturer} / {p.name}
                    {p.archived ? "（台帳で削除済み）" : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={`配合 ${index + 1}（%）`}>
              <input
                type="number"
                min="0.1"
                max="100"
                step="0.1"
                required
                disabled={draft.paintUsages.length === 1}
                value={u.ratioInput ?? u.ratioTenths / 10}
                onChange={(e) =>
                  update(
                    setDraft,
                    "paintUsages",
                    draft.paintUsages.map((x, i) =>
                      i === index ? { ...x, ratioInput: e.target.value } : x,
                    ),
                  )
                }
              />
            </Field>
            <Button
              onClick={() => {
                if (!window.confirm("この工程から使用塗料を削除しますか？"))
                  return;
                const next = draft.paintUsages.filter((_, i) => i !== index);
                if (next.length === 1)
                  next[0] = {
                    ...next[0],
                    ratioTenths: 1000,
                    ratioInput: "100",
                  };
                update(setDraft, "paintUsages", next);
              }}
            >
              塗料削除
            </Button>
          </div>
        ))}
        <p>
          配合合計：
          {draft.paintUsages
            .reduce(
              (sum, u) => sum + Number(u.ratioInput ?? u.ratioTenths / 10),
              0,
            )
            .toFixed(1)}
          %
        </p>
        <Button
          disabled={draft.paintUsages.length >= 10}
          onClick={() =>
            update(setDraft, "paintUsages", [
              ...draft.paintUsages,
              {
                paintId: "",
                ratioTenths: draft.paintUsages.length ? 0 : 1000,
                ratioInput: draft.paintUsages.length ? "" : "100",
              },
            ])
          }
        >
          ＋ 使用塗料
        </Button>
        {!choices.length && <p>先に保有塗料台帳へ塗料を登録してください。</p>}
      </fieldset>
      <Memo
        value={draft.memo}
        onChange={(value) => update(setDraft, "memo", value)}
      />
    </>
  );
}
export function prepareProcess(draft) {
  return {
    ...draft,
    paintUsages: draft.paintUsages.map((u) => ({
      paintId: u.paintId,
      ratioTenths:
        draft.paintUsages.length === 1
          ? 1000
          : ratioTenths(u.ratioInput ?? u.ratioTenths / 10),
    })),
  };
}
export function MaskingFields({ draft, setDraft, kit }) {
  const group = kit.groups.find((g) => g.id === draft.groupId);
  return (
    <>
      <Field label="対象ランナー（必須）">
        <select
          required
          value={draft.runnerId}
          onChange={(e) =>
            setDraft({
              ...draft,
              runnerId: e.target.value,
              groupId: null,
              beforeProcessId: null,
            })
          }
        >
          <option value="">選択してください</option>
          {kit.runners.map((r) => (
            <option key={r.id} value={r.id}>
              {r.symbol}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label="パーツ番号（任意）"
        maxLength={20}
        value={draft.partNumber}
        onChange={(e) => update(setDraft, "partNumber", e.target.value)}
      />
      <Field
        label="対象部位"
        maxLength={100}
        value={draft.bodyArea}
        onChange={(e) => update(setDraft, "bodyArea", e.target.value)}
      />
      <Field label="マスキング箇所（必須）">
        <textarea
          required
          maxLength={500}
          value={draft.location}
          onChange={(e) => update(setDraft, "location", e.target.value)}
        />
      </Field>
      <Field label="対象グループ（任意）">
        <select
          value={draft.groupId || ""}
          onChange={(e) =>
            setDraft({
              ...draft,
              groupId: e.target.value || null,
              beforeProcessId: null,
            })
          }
        >
          <option value="">キット共通</option>
          {kit.groups
            .filter((g) => g.targets.some((t) => t.runnerId === draft.runnerId))
            .map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
        </select>
      </Field>
      <Field label="実施する工程の直前（任意）">
        <select
          disabled={!group}
          value={draft.beforeProcessId || ""}
          onChange={(e) =>
            update(setDraft, "beforeProcessId", e.target.value || null)
          }
        >
          <option value="">{group ? "グループの先頭" : "キット共通"}</option>
          {group?.processes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      <Memo
        label="手順"
        value={draft.procedure}
        onChange={(value) => update(setDraft, "procedure", value)}
      />
      <Memo
        value={draft.memo}
        onChange={(value) => update(setDraft, "memo", value)}
      />
    </>
  );
}
export function PaintFields({ draft, setDraft, paints }) {
  const choices = {
    manufacturer: ["ガイアノーツ", "GSIクレオス", "タミヤ", "その他"],
    type: ["ラッカー系", "水性アクリル系", "エナメル系", "その他"],
  };
  return (
    <>
      {[
        ["name", "塗料名"],
        ["manufacturer", "メーカー"],
        ["color", "色"],
        ["type", "塗料種類"],
      ].map(([key, label]) =>
        choices[key] ? (
          <Field
            key={key}
            label={`${label}${key === "manufacturer" ? "（必須）" : ""}`}
          >
            <select
              required={key === "manufacturer"}
              value={draft[key]}
              onChange={(e) => update(setDraft, key, e.target.value)}
            >
              <option value="">
                {key === "manufacturer" ? "選択してください" : "未指定"}
              </option>
              {draft[key] && !choices[key].includes(draft[key]) && (
                <option value={draft[key]}>{draft[key]}（登録済み）</option>
              )}
              {choices[key].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Field
            key={key}
            label={`${label}（必須）`}
            required
            maxLength={100}
            value={draft[key]}
            onChange={(e) => update(setDraft, key, e.target.value)}
          />
        ),
      )}
      {duplicatePaint(draft, paints) && (
        <Message>
          同じメーカー・塗料名が登録されています。追加購入の場合は既存商品の瓶を追加してください。
        </Message>
      )}
      <fieldset>
        <legend>原液の瓶：{draft.bottles.length}本</legend>
        {draft.bottles.map((b, index) => (
          <div className="usage-row" key={b.id}>
            <Field
              label={`瓶 ${index + 1} ラベル（必須）`}
              required
              maxLength={50}
              value={b.label}
              onChange={(e) =>
                update(
                  setDraft,
                  "bottles",
                  draft.bottles.map((x) =>
                    x.id === b.id ? { ...x, label: e.target.value } : x,
                  ),
                )
              }
            />
            <Field
              label={`瓶 ${index + 1} 残量（%・空欄可）`}
              type="number"
              min="0"
              max="100"
              step="1"
              value={b.remainingPercent ?? ""}
              onChange={(e) =>
                update(
                  setDraft,
                  "bottles",
                  draft.bottles.map((x) =>
                    x.id === b.id
                      ? {
                          ...x,
                          remainingPercent:
                            e.target.value === ""
                              ? null
                              : Number(e.target.value),
                        }
                      : x,
                  ),
                )
              }
            />
            <Button
              onClick={() => {
                if (
                  window.confirm(
                    `「${b.label}」を削除し、原液の保有数量を1本減らしますか？`,
                  )
                )
                  update(
                    setDraft,
                    "bottles",
                    draft.bottles.filter((x) => x.id !== b.id),
                  );
              }}
            >
              瓶削除
            </Button>
          </div>
        ))}
        <Button
          onClick={() => {
            let n = draft.bottles.length + 1;
            while (draft.bottles.some((b) => b.label === `瓶${n}`)) n++;
            update(setDraft, "bottles", [
              ...draft.bottles,
              { id: uuid(), label: `瓶${n}`, remainingPercent: null },
            ]);
          }}
        >
          ＋ 原液の瓶
        </Button>
      </fieldset>
      <Field
        label="希釈済みボトル本数（必須）"
        type="number"
        required
        min="0"
        step="1"
        value={draft.dilutedBottleCount}
        onChange={(e) =>
          update(
            setDraft,
            "dilutedBottleCount",
            e.target.value === "" ? "" : Number(e.target.value),
          )
        }
      />
      <Memo
        value={draft.memo}
        onChange={(value) => update(setDraft, "memo", value)}
      />
    </>
  );
}
export function normalizeRunner(draft) {
  return { ...draft, symbol: normalizeSymbol(draft.symbol) };
}
