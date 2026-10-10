import { describe, it, expect } from "vitest";
import {
  validateKit,
  validatePaint,
  normalizeSymbol,
  ratioTenths,
  references,
  move,
  hasStock,
  maskingLabel,
  duplicatePaint,
  assertRevision,
  newMasking,
  matchesPaint,
  sameData,
} from "../src/domain.js";
import { kit, paint, paints } from "./fixtures.js";
describe("P-001〜P-005 キット", () => {
  it("必須名、文字数、保存サイズを検証する", () => {
    const k = kit();
    expect(validateKit(k, paints())).toBe(k);
    k.name = " ";
    expect(() => validateKit(k, paints())).toThrow("キット名");
    k.name = "a".repeat(101);
    expect(() => validateKit(k, paints())).toThrow("100文字");
  });
  it("500KiB超の計画を切り捨てず拒否する", () => {
    const k = kit();
    k.runners = Array.from({ length: 100 }, (_, i) => ({
      id: `r${i}`,
      symbol: `R${i}`,
      memo: "あ".repeat(2000),
      colors: [{ id: `c${i}`, name: "白" }],
    }));
    k.groups = [];
    expect(() => validateKit(k, paints())).toThrow("500KiB");
  });
});
describe("P-006、P-007、P-014、P-015 ランナー・グループ", () => {
  it("記号を正規化し一意性を検証する", () => {
    expect(normalizeSymbol(" a1 ")).toBe("A1");
    const k = kit();
    k.runners.push({ ...k.runners[0], id: "other" });
    expect(() => validateKit(k, paints())).toThrow("ランナー記号");
  });
  it("同一成形色を複数グループに登録できる", () => {
    const k = kit();
    k.groups.push({ ...k.groups[0], id: "group-2", name: "レッド" });
    expect(() => validateKit(k, paints())).not.toThrow();
  });
  it("グループ内の対象重複を拒否する", () => {
    const k = kit();
    k.groups[0].targets.push(k.groups[0].targets[0]);
    expect(() => validateKit(k, paints())).toThrow("対象");
  });
  it("名前変更でも固定IDで参照を保つ", () => {
    const k = kit();
    k.runners[0].colors[0].name = "クリアレッド";
    expect(() => validateKit(k, paints())).not.toThrow();
  });
  it("参照中のランナー・成形色削除を拒否する", () => {
    const k = kit();
    expect(references(k, "runner", "runner-a")).toContain("グループ：ホワイト");
    expect(references(k, "color", "red")).toContain("グループ：ホワイト");
    k.runners[0].colors.shift();
    expect(() => validateKit(k, paints())).toThrow("参照を解除");
  });
  it("未割当色、工程0件を保存できる", () => {
    const k = kit();
    k.groups[0].processes = [];
    expect(() => validateKit(k, paints())).not.toThrow();
  });
  it("件数上限とグループ名一意性を検証する", () => {
    const k = kit();
    k.groups.push({ ...k.groups[0], id: "second" });
    expect(() => validateKit(k, paints())).toThrow("グループ名");
    k.groups = [];
    k.runners[0].colors = Array.from({ length: 11 }, (_, i) => ({
      id: `c${i}`,
      name: "色",
    }));
    expect(() => validateKit(k, paints())).toThrow("10件");
  });
});
describe("P-008、P-009、P-016、P-021 使用塗料と工程", () => {
  it("70/30は保存でき、70/40は保存不可", () => {
    const k = kit();
    expect(() => validateKit(k, paints())).not.toThrow();
    k.groups[0].processes[0].paintUsages[1].ratioTenths = 400;
    expect(() => validateKit(k, paints())).toThrow("100%");
  });
  it("0.1%を整数で扱い、2桁小数・0%・負数を拒否する", () => {
    expect(ratioTenths("33.3")).toBe(333);
    for (const value of ["0", "-1", "33.33", "NaN", "100.1"])
      expect(() => ratioTenths(value)).toThrow();
  });
  it("塗料なし、同一塗料の重複を拒否する", () => {
    const k = kit();
    k.groups[0].processes[0].paintUsages = [];
    expect(() => validateKit(k, paints())).toThrow("1件以上");
    k.groups[0].processes[0].paintUsages = [
      { paintId: "white", ratioTenths: 500 },
      { paintId: "white", ratioTenths: 500 },
    ];
    expect(() => validateKit(k, paints())).toThrow("重複");
  });
  it("単色100%、上下移動と境界を扱う", () => {
    const k = kit();
    k.groups[0].processes[0].paintUsages = [
      { paintId: "white", ratioTenths: 1000 },
    ];
    expect(() => validateKit(k, paints())).not.toThrow();
    expect(move(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"]);
    expect(move(["a"], 0, -1)).toEqual(["a"]);
  });
  it("削除済み塗料は既存参照のみ維持する", () => {
    const k = kit();
    const ps = paints();
    ps[0].archived = true;
    expect(() => validateKit(k, ps, k)).not.toThrow();
    expect(() => validateKit(k, ps)).toThrow("削除済み");
  });
});
describe("P-010、P-017 マスキング", () => {
  it("番号未指定を保存し表示する", () => {
    const k = kit();
    const m = {
      ...newMasking(),
      runnerId: "runner-a",
      location: "センサー周辺",
    };
    k.maskings = [m];
    expect(() => validateKit(k, paints())).not.toThrow();
    expect(maskingLabel(k, m)).toContain("番号未指定");
  });
  it("グループと工程の参照解除を要求する", () => {
    const k = kit();
    k.maskings = [
      {
        ...newMasking(),
        runnerId: "runner-a",
        location: "センサー",
        groupId: "group-1",
        beforeProcessId: "process-1",
      },
    ];
    expect(references(k, "group", "group-1")).toEqual(["マスキング：センサー"]);
    expect(references(k, "process", "process-1")).toEqual([
      "マスキング：センサー",
    ]);
    k.groups[0].processes = [];
    expect(() => validateKit(k, paints())).toThrow("参照工程");
  });
  it("グループ変更で対象の整合性が崩れたら拒否する", () => {
    const k = kit();
    k.maskings = [
      {
        ...newMasking(),
        runnerId: "runner-a",
        location: "センサー",
        groupId: "missing",
      },
    ];
    expect(() => validateKit(k, paints())).toThrow("含まれていません");
  });
});
describe("P-011〜P-013、P-018 塗料台帳", () => {
  it("原液0本・希釈済み1本を在庫ありにする", () => {
    const p = paint();
    p.bottles = [];
    p.dilutedBottleCount = 1;
    expect(() => validatePaint(p)).not.toThrow();
    expect(hasStock(p)).toBe(true);
    p.dilutedBottleCount = 0;
    expect(hasStock(p)).toBe(false);
  });
  it("残量0%の瓶は原液数量に含める", () => {
    const p = paint();
    p.bottles[0].remainingPercent = 0;
    expect(hasStock(p)).toBe(true);
    expect(p.bottles.length).toBe(1);
  });
  it("残量は未設定または整数0〜100、瓶ラベルは一意", () => {
    const p = paint();
    for (const value of [null, 0, 100]) {
      p.bottles[0].remainingPercent = value;
      expect(() => validatePaint(p)).not.toThrow();
    }
    for (const value of [-1, 101, 1.5]) {
      p.bottles[0].remainingPercent = value;
      expect(() => validatePaint(p)).toThrow("残量");
    }
    p.bottles[0].remainingPercent = 80;
    p.bottles.push({ ...p.bottles[0], id: "b2" });
    expect(() => validatePaint(p)).toThrow("ラベル");
  });
  it("希釈済み本数の負数・小数・空欄を拒否する", () => {
    const p = paint();
    for (const value of [-1, 1.5, "", Number.MAX_SAFE_INTEGER + 1]) {
      p.dilutedBottleCount = value;
      expect(() => validatePaint(p)).toThrow("安全な整数");
    }
  });
  it("同一メーカー・商品名は重複候補として警告する", () => {
    const p = paint();
    expect(duplicatePaint({ ...p, id: "new" }, [p])).toBe(true);
    expect(duplicatePaint(p, [p])).toBe(false);
  });
  it("名前は空白除去・英字大小無視、絞り込みはAND", () => {
    const p = paint();
    p.name = "Cool White";
    expect(
      matchesPaint(p, {
        name: " WHITE ",
        manufacturer: "GSIクレオス",
        stock: "yes",
      }),
    ).toBe(true);
    expect(matchesPaint(p, { name: "WHITE", color: "赤" })).toBe(false);
  });
});
describe("競合・再試行", () => {
  it("古いrevisionは更新不可", () => {
    expect(() => assertRevision(2, 1)).toThrow("別端末");
    expect(() => assertRevision(2, 2)).not.toThrow();
  });
  it("保存確認はキー順に依存しない", () => {
    expect(
      sameData({ a: 1, b: [{ x: 2, y: 3 }] }, { b: [{ y: 3, x: 2 }], a: 1 }),
    ).toBe(true);
    expect(sameData({ a: 1 }, { a: 2 })).toBe(false);
  });
});
