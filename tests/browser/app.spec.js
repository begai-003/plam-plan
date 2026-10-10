import { test, expect } from "@playwright/test";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
let admin;
test.beforeAll(async () => {
  admin = initializeApp({ projectId: "demo-plam-plan" });
  await getAuth(admin).importUsers([
    {
      uid: "test-owner",
      email: "owner@example.test",
      emailVerified: true,
      displayName: "Owner",
      providerData: [
        {
          providerId: "google.com",
          uid: "google-owner",
          email: "owner@example.test",
          displayName: "Owner",
        },
      ],
    },
    {
      uid: "other-user",
      email: "other@example.test",
      emailVerified: true,
      displayName: "Other",
      providerData: [
        {
          providerId: "google.com",
          uid: "google-other",
          email: "other@example.test",
          displayName: "Other",
        },
      ],
    },
  ]);
});
test.afterAll(async () => {
  await deleteApp(admin);
});
async function signIn(page, email = "owner@example.test") {
  if (process.env.TEST_OAUTH_POPUP !== "true") {
    await page.evaluate(async (email) => {
      const helper =
        await import("/plam-plan/tests/support/googleCredential.js");
      await helper.signInAs(email);
    }, email);
    return;
  }
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Googleでログイン" }).click();
  const popup = await popupPromise;
  await popup.getByText(email, { exact: true }).click();
}
async function addPaint(page, name) {
  await page.getByRole("button", { name: "＋ 塗料登録" }).click();
  await page.getByLabel("塗料名（必須）").fill(name);
  await page.getByLabel("メーカー（必須）").fill("GSIクレオス");
  await page.getByLabel("色（必須）").fill("白");
  await page.getByRole("button", { name: "＋ 原液の瓶" }).click();
  await page.getByLabel("瓶 1 残量（%・空欄可）").fill("80");
  await page.getByLabel("希釈済みボトル本数（必須）").fill("1");
  await page.getByRole("button", { name: "登録", exact: true }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
}
test("P-001〜P-021: Google認証、台帳、塗装計画、参照制約、編集・削除", async ({
  page,
  context,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (dialog) => dialog.accept());
  // The official Auth Emulator widget's optional styling resources are unnecessary.
  await context.route(
    /https:\/\/(unpkg.com|fonts.googleapis.com|fonts.gstatic.com)\//,
    (route) => route.abort(),
  );
  await page.goto("./#/kits/missing");
  await signIn(page, "other@example.test");
  await expect(page.getByRole("alert")).toContainText(
    "このアカウントでは利用できません",
  );
  await signIn(page);
  await expect(
    page.getByRole("heading", { name: "見つかりません" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "キット一覧へ", exact: true }).click();
  await page.getByRole("button", { name: "保有塗料", exact: true }).click();
  await addPaint(page, "クールホワイト");
  await addPaint(page, "ニュートラルグレー");
  await page.getByLabel("塗料検索").fill("ホワイト");
  await expect(
    page.getByRole("heading", { name: "ニュートラルグレー", exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel("メーカー", { exact: true })
    .selectOption("GSIクレオス");
  await page.getByLabel("塗料検索").fill("");
  const white = page.locator("article").filter({
    has: page.getByRole("heading", { name: "クールホワイト", exact: true }),
  });
  await white.getByRole("button", { name: "編集", exact: true }).click();
  await page.getByLabel("瓶 1 残量（%・空欄可）").fill("0");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(white.getByText("残量 0%")).toBeVisible();
  await page.getByRole("button", { name: "キット一覧", exact: true }).click();
  await page.getByRole("button", { name: "＋ キット登録" }).click();
  await page.getByLabel("キット名（必須）").fill("RG νガンダム");
  await page.getByLabel("シリーズ", { exact: true }).fill("RG");
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await page.getByRole("button", { name: "登録", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "RG νガンダム", exact: true }),
  ).toBeVisible();
  await expect(page.locator("img")).toHaveCount(0);
  await page.getByRole("tab", { name: "ランナー", exact: true }).click();
  await page.getByRole("button", { name: "＋ ランナー", exact: true }).click();
  await page.getByLabel("ランナー記号（必須）").fill(" a ");
  await page.getByLabel("成形色 1", { exact: true }).fill("赤");
  await page.getByRole("button", { name: "＋ 成形色" }).click();
  await page.getByLabel("成形色 2", { exact: true }).fill("黄");
  await page.getByRole("button", { name: "＋ 成形色" }).click();
  await page.getByLabel("成形色 3", { exact: true }).fill("黒");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Aランナー", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "塗装計画", exact: true }).click();
  await page.getByRole("button", { name: "＋ 塗装グループ" }).click();
  await page.getByLabel("グループ名（必須）").fill("ホワイト");
  await page.getByLabel("塗装後の色（必須）").fill("白");
  await page.getByRole("checkbox", { name: "赤", exact: true }).check();
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByRole("button", { name: "＋ 塗装工程" }).click();
  await page.getByLabel("工程名（必須）").fill("本色");
  await page.getByRole("button", { name: "＋ 使用塗料" }).click();
  await page
    .getByLabel("塗料 1", { exact: true })
    .selectOption({ label: "GSIクレオス / クールホワイト" });
  await page.getByRole("button", { name: "＋ 使用塗料" }).click();
  await page
    .getByLabel("塗料 2", { exact: true })
    .selectOption({ label: "GSIクレオス / ニュートラルグレー" });
  await page.getByLabel("配合 1（%）").fill("70");
  await page.getByLabel("配合 2（%）").fill("40");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("合計を100%");
  await expect(page.getByLabel("工程名（必須）")).toHaveValue("本色");
  await page.getByLabel("配合 2（%）").fill("30");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("70%", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "＋ 塗装工程" }).click();
  await page.getByLabel("工程名（必須）").fill("下地");
  await page.getByLabel("工程種別（必須）").selectOption("下地");
  await page.getByRole("button", { name: "＋ 使用塗料" }).click();
  await page
    .getByLabel("塗料 1", { exact: true })
    .selectOption({ label: "GSIクレオス / クールホワイト" });
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByRole("button", { name: "下地を上へ", exact: true }).click();
  await expect(page.locator(".process h3").first()).toContainText("下地");
  await page.getByRole("tab", { name: "マスキング", exact: true }).click();
  await page.getByRole("button", { name: "＋ マスキング" }).click();
  await page.getByLabel("対象ランナー（必須）").selectOption({ label: "A" });
  await page.getByLabel("マスキング箇所（必須）").fill("センサー周辺");
  await page
    .getByLabel("対象グループ（任意）")
    .selectOption({ label: "ホワイト" });
  await page
    .getByLabel("実施する工程の直前（任意）")
    .selectOption({ label: "本色" });
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("heading", { name: /番号未指定/ })).toBeVisible();
  await page.getByRole("tab", { name: "塗装計画", exact: true }).click();
  await expect(page.locator(".masking-notice")).toContainText("センサー周辺");
  const basecoat = page
    .locator(".process")
    .filter({ has: page.getByRole("heading", { name: /本色/ }) });
  await basecoat.getByRole("button", { name: "削除", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("参照中");
  await page.getByRole("tab", { name: "ランナー", exact: true }).click();
  await page.getByRole("button", { name: "削除", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("参照中");
  await page.getByRole("button", { name: "編集", exact: true }).click();
  await page.getByLabel("成形色 1", { exact: true }).fill("クリアレッド");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("クリアレッド", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "塗装計画", exact: true }).click();
  await page.getByRole("button", { name: "＋ 塗装グループ" }).click();
  await page.getByLabel("グループ名（必須）").fill("レッド");
  await page.getByLabel("塗装後の色（必須）").fill("赤");
  await page
    .getByRole("checkbox", { name: "クリアレッド", exact: true })
    .check();
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "レッド", exact: true }),
  ).toBeVisible();
  // Leave an edit dirty; cancelling discard must preserve the form.
  await page.getByRole("button", { name: "キット編集", exact: true }).click();
  await page.getByLabel("キット名（必須）").fill("RG νガンダム 改");
  await page.getByRole("button", { name: "変更を保存" }).click();
  await expect(
    page.getByRole("heading", { name: "RG νガンダム 改", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "保有塗料", exact: true }).click();
  await white.getByRole("button", { name: "台帳から削除" }).click();
  await expect(
    page.getByRole("heading", { name: "クールホワイト", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("checkbox", { name: "削除済みを表示" }).check();
  await expect(
    page.getByRole("heading", { name: "クールホワイト", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "復元", exact: true }).click();
  await page.getByRole("button", { name: "キット一覧", exact: true }).click();
  await page.getByRole("button", { name: "リスト表示" }).click();
  await page.getByRole("button", { name: "詳細を見る →" }).click();
  const detailUrl = page.url();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "RG νガンダム 改", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 360, height: 800 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= 360),
    )
    .toBe(true);
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
  await page.getByRole("button", { name: "キット削除", exact: true }).click();
  await expect(
    page.getByText("まだキットがありません。", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "保有塗料", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "クールホワイト", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "ログアウト", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Googleでログイン" }),
  ).toBeVisible();
  await page.goto(detailUrl);
  await expect(
    page.getByRole("button", { name: "Googleでログイン" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("別端末の競合、オフライン保存、未保存確認、モーダルのキーボード操作", async ({
  page,
  context,
}) => {
  const { getFirestore, Timestamp } = await import("firebase-admin/firestore");
  const { kit, paint } = await import("../fixtures.js");
  const db = getFirestore(admin);
  const now = Timestamp.now();
  const { id: paintId, ...p } = paint();
  await db
    .doc("users/test-owner/paints/white")
    .set({ ...p, revision: 1, createdAt: now, updatedAt: now });
  const k = kit();
  k.groups[0].processes[0].paintUsages = [
    { paintId: "white", ratioTenths: 1000 },
  ];
  await db
    .doc("users/test-owner/kits/concurrent")
    .set({
      ...k,
      imagePath: "users/test-owner/kits/concurrent/legacy",
      revision: 1,
      createdAt: now,
      updatedAt: now,
    });
  let accept = true;
  page.on("dialog", (d) => (accept ? d.accept() : d.dismiss()));
  await page.goto("./#/kits/concurrent");
  await signIn(page);
  await expect(
    page.getByRole("heading", { name: "RG νガンダム", exact: true }),
  ).toBeVisible();
  const second = await context.newPage();
  await second.goto("./#/kits/concurrent");
  await expect(
    second.getByRole("heading", { name: "RG νガンダム", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "キット編集", exact: true }).click();
  await page.getByLabel("キット名（必須）").fill("入力を保持する名前");
  await second.getByRole("button", { name: "キット編集", exact: true }).click();
  await second.getByLabel("キット名（必須）").fill("別端末で変更した名前");
  await second.getByRole("button", { name: "変更を保存" }).click();
  await expect(
    second.getByRole("heading", { name: "別端末で変更した名前", exact: true }),
  ).toBeVisible();
  expect(
    (await db.doc("users/test-owner/kits/concurrent").get()).data(),
  ).not.toHaveProperty("imagePath");
  await page.getByRole("button", { name: "変更を保存" }).click();
  await expect(page.getByRole("alert")).toContainText("別端末");
  await expect(page.getByLabel("キット名（必須）")).toHaveValue(
    "入力を保持する名前",
  );
  accept = false;
  await page.getByRole("button", { name: "保有塗料", exact: true }).click();
  await expect(page.getByLabel("キット名（必須）")).toHaveValue(
    "入力を保持する名前",
  );
  await context.setOffline(true);
  await expect(page.getByRole("button", { name: "変更を保存" })).toBeDisabled();
  await expect(
    page.getByRole("alert").filter({ hasText: "オフライン" }),
  ).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByRole("button", { name: "変更を保存" })).toBeEnabled();
  accept = true;
  await page.getByRole("button", { name: "キャンセル", exact: true }).click();
  await page.getByRole("tab", { name: "ランナー", exact: true }).click();
  const opener = page.getByRole("button", { name: "＋ ランナー", exact: true });
  await opener.click();
  await page.getByLabel("ランナー記号（必須）").fill("B");
  await page.getByLabel("成形色 1", { exact: true }).fill("白");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(opener).toBeFocused();
  await expect(
    page.getByRole("heading", { name: "Bランナー", exact: true }),
  ).toHaveCount(0);
  await second.close();
});
