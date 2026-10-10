export const uuid = () => crypto.randomUUID();
export const clone = (value) => structuredClone(value);
export const TYPES = ["下地", "中間", "本色", "トップコート", "その他"];
export const METHODS = ["", "エアブラシ", "筆塗り", "スプレー", "その他"];
export const normalizeSymbol = (value) => value.trim().toUpperCase();
export const hasStock = (paint) =>
  paint.bottles.length > 0 || paint.dilutedBottleCount > 0;
export const newKit = () => ({
  schemaVersion: 1,
  name: "",
  series: "",
  memo: "",
  runners: [],
  groups: [],
  maskings: [],
  status: "active",
});
export const newPaint = () => ({
  schemaVersion: 1,
  name: "",
  manufacturer: "",
  color: "",
  type: "",
  memo: "",
  bottles: [],
  dilutedBottleCount: 0,
  archived: false,
});
export const newRunner = () => ({
  id: uuid(),
  symbol: "",
  colors: [{ id: uuid(), name: "" }],
  memo: "",
});
export const newGroup = () => ({
  id: uuid(),
  name: "",
  resultColor: "",
  targets: [],
  memo: "",
  processes: [],
});
export const newProcess = () => ({
  id: uuid(),
  name: "",
  type: "本色",
  method: "",
  paintUsages: [],
  memo: "",
});
export const newMasking = () => ({
  id: uuid(),
  runnerId: "",
  partNumber: "",
  bodyArea: "",
  location: "",
  procedure: "",
  memo: "",
  groupId: null,
  beforeProcessId: null,
});
export function ratioTenths(value) {
  if (!/^\d+(\.\d)?$/.test(String(value)))
    throw new Error("配合比率は0.1%単位で入力してください");
  const result = Math.round(Number(value) * 10);
  if (result <= 0 || result > 1000)
    throw new Error("配合比率は0より大きく100%以下にしてください");
  return result;
}
const requireThat = (valid, message) => {
  if (!valid) throw new Error(message);
};
function text(value, label, max, required = false) {
  requireThat(typeof value === "string", `${label}の形式が不正です`);
  requireThat(
    !required || value.trim().length > 0,
    `${label}を入力してください`,
  );
  requireThat(value.length <= max, `${label}は${max}文字以内にしてください`);
}
function unique(values, label) {
  requireThat(
    new Set(values).size === values.length,
    `${label}が重複しています`,
  );
}
function ids(items, label) {
  unique(
    items.map((x) => x.id),
    label,
  );
  items.forEach((x) => text(x.id, `${label}ID`, 100, true));
}
function maxCount(items, count, label) {
  requireThat(
    Array.isArray(items) && items.length <= count,
    `${label}は${count}件以内にしてください`,
  );
}
function sizeCheck(value) {
  requireThat(
    new TextEncoder().encode(JSON.stringify(value)).length <= 500 * 1024,
    "保存データは500KiB以下にしてください。項目を減らしてください",
  );
}
export function validatePaint(paint) {
  for (const [key, label] of [
    ["name", "塗料名"],
    ["manufacturer", "メーカー"],
    ["color", "色"],
  ])
    text(paint[key], label, 100, true);
  text(paint.type, "塗料種類", 100);
  text(paint.memo, "メモ", 2000);
  requireThat(Array.isArray(paint.bottles), "瓶の形式が不正です");
  ids(paint.bottles, "瓶");
  unique(
    paint.bottles.map((b) => b.label.trim()),
    "瓶ラベル",
  );
  paint.bottles.forEach((b) => {
    text(b.label, "瓶ラベル", 50, true);
    requireThat(
      b.remainingPercent === null ||
        (Number.isInteger(b.remainingPercent) &&
          b.remainingPercent >= 0 &&
          b.remainingPercent <= 100),
      "瓶の残量は整数0〜100%または未設定にしてください",
    );
  });
  requireThat(
    Number.isSafeInteger(paint.dilutedBottleCount) &&
      paint.dilutedBottleCount >= 0,
    "希釈済みボトル本数は0以上の安全な整数にしてください",
  );
  requireThat(typeof paint.archived === "boolean", "削除状態が不正です");
  sizeCheck(paint);
  return paint;
}
export function validateKit(kit, paints = [], previous = null) {
  text(kit.name, "キット名", 100, true);
  text(kit.series, "シリーズ", 100);
  text(kit.memo, "メモ", 2000);
  requireThat(
    ["active", "deleting"].includes(kit.status),
    "キットの状態が不正です",
  );
  maxCount(kit.runners, 100, "ランナー");
  maxCount(kit.groups, 100, "グループ");
  maxCount(kit.maskings, 200, "マスキング");
  ids(kit.runners, "ランナー");
  ids(kit.groups, "グループ");
  ids(kit.maskings, "マスキング");
  unique(
    kit.runners.map((r) => normalizeSymbol(r.symbol)),
    "ランナー記号",
  );
  unique(
    kit.groups.map((g) => g.name.trim()),
    "グループ名",
  );
  kit.runners.forEach((r) => {
    text(r.symbol, "ランナー記号", 20, true);
    requireThat(
      r.symbol === normalizeSymbol(r.symbol),
      "ランナー記号の空白を除去し大文字にしてください",
    );
    text(r.memo, "メモ", 2000);
    maxCount(r.colors, 10, "成形色");
    requireThat(r.colors.length > 0, "成形色を1件以上登録してください");
    ids(r.colors, "成形色");
    r.colors.forEach((c) => text(c.name, "成形色", 100, true));
  });
  kit.groups.forEach((g) => {
    text(g.name, "グループ名", 100, true);
    text(g.resultColor, "塗装後の色", 100, true);
    text(g.memo, "メモ", 2000);
    requireThat(
      Array.isArray(g.targets) && g.targets.length > 0,
      "対象ランナー・成形色を選択してください",
    );
    unique(
      g.targets.map((t) => `${t.runnerId}/${t.colorId}`),
      "グループ内の対象",
    );
    g.targets.forEach((t) =>
      requireThat(
        kit.runners.some(
          (r) =>
            r.id === t.runnerId && r.colors.some((c) => c.id === t.colorId),
        ),
        `グループ「${g.name}」の対象成形色が存在しません。参照を解除してください`,
      ),
    );
    maxCount(g.processes, 20, "工程");
    ids(g.processes, "工程");
    g.processes.forEach((p) => {
      text(p.name, "工程名", 100, true);
      requireThat(TYPES.includes(p.type), "工程種別を選択してください");
      requireThat(METHODS.includes(p.method), "塗装方法が不正です");
      text(p.memo, "メモ", 2000);
      maxCount(p.paintUsages, 10, "使用塗料");
      requireThat(
        p.paintUsages.length > 0,
        "使用塗料を1件以上登録してください",
      );
      unique(
        p.paintUsages.map((u) => u.paintId),
        "使用塗料",
      );
      requireThat(
        p.paintUsages.every(
          (u) =>
            Number.isInteger(u.ratioTenths) &&
            u.ratioTenths > 0 &&
            u.ratioTenths <= 1000,
        ) && p.paintUsages.reduce((s, u) => s + u.ratioTenths, 0) === 1000,
        "配合比率の合計を100%にしてください",
      );
      p.paintUsages.forEach((u) => {
        const paint = paints.find((x) => x.id === u.paintId);
        requireThat(paint, "塗料が見つかりません。台帳に登録してください");
        const retained = previous?.groups
          .find((x) => x.id === g.id)
          ?.processes.find((x) => x.id === p.id)
          ?.paintUsages.some((x) => x.paintId === u.paintId);
        requireThat(
          !paint.archived || retained,
          "削除済みの塗料は新規選択できません",
        );
      });
    });
  });
  kit.maskings.forEach((m) => {
    requireThat(
      kit.runners.some((r) => r.id === m.runnerId),
      "マスキングの対象ランナーが存在しません。参照を解除してください",
    );
    text(m.partNumber, "パーツ番号", 20);
    text(m.bodyArea, "対象部位", 100);
    text(m.location, "マスキング箇所", 500, true);
    text(m.procedure, "手順", 2000);
    text(m.memo, "メモ", 2000);
    const group = kit.groups.find((g) => g.id === m.groupId);
    if (m.groupId !== null)
      requireThat(
        group?.targets.some((t) => t.runnerId === m.runnerId),
        "マスキングの対象ランナーが指定グループに含まれていません。参照を解除してください",
      );
    requireThat(
      m.beforeProcessId === null ||
        group?.processes.some((p) => p.id === m.beforeProcessId),
      "マスキングの参照工程が存在しません。参照を解除してください",
    );
  });
  sizeCheck(kit);
  return kit;
}
export function references(kit, kind, id) {
  if (kind === "runner")
    return [
      ...kit.groups
        .filter((g) => g.targets.some((t) => t.runnerId === id))
        .map((g) => `グループ：${g.name}`),
      ...kit.maskings
        .filter((m) => m.runnerId === id)
        .map((m) => `マスキング：${m.location}`),
    ];
  if (kind === "color")
    return kit.groups
      .filter((g) => g.targets.some((t) => t.colorId === id))
      .map((g) => `グループ：${g.name}`);
  return kit.maskings
    .filter((m) =>
      kind === "group" ? m.groupId === id : m.beforeProcessId === id,
    )
    .map((m) => `マスキング：${m.location}`);
}
export function move(items, index, offset) {
  const result = [...items];
  const destination = index + offset;
  if (destination < 0 || destination >= items.length) return result;
  [result[index], result[destination]] = [result[destination], result[index]];
  return result;
}
export function targetLabel(kit, target) {
  const runner = kit.runners.find((r) => r.id === target.runnerId);
  return `${runner?.symbol ?? "不明"} / ${runner?.colors.find((c) => c.id === target.colorId)?.name ?? "不明"}`;
}
export function maskingLabel(kit, m) {
  return `${kit.runners.find((r) => r.id === m.runnerId)?.symbol ?? "不明"} / ${m.partNumber || "ランナー全体／番号未指定"}`;
}
export function duplicatePaint(paint, paints) {
  return paints.some(
    (p) =>
      p.id !== paint.id &&
      p.name.trim() === paint.name.trim() &&
      p.manufacturer.trim() === paint.manufacturer.trim(),
  );
}
export function assertRevision(current, expected) {
  requireThat(
    current === expected,
    "別端末で更新されました。入力内容を控えて再読み込みしてください",
  );
}
export function matchesPaint(paint, filters) {
  const normalize = (value) => value.trim().toLocaleLowerCase();
  return (
    normalize(paint.name).includes(normalize(filters.name || "")) &&
    ["manufacturer", "color", "type"].every(
      (key) => !filters[key] || paint[key] === filters[key],
    ) &&
    (!filters.stock ||
      filters.stock === "all" ||
      hasStock(paint) === (filters.stock === "yes"))
  );
}
export function sameData(a, b) {
  const canonical = (value) =>
    Array.isArray(value)
      ? value.map(canonical)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.keys(value)
              .sort()
              .map((key) => [key, canonical(value[key])]),
          )
        : value;
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}
