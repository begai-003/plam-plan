# plam-plan

プラモデルの塗装計画を保存・管理する本人専用のWebアプリです。React / Vite と Firebase Authentication・Cloud Firestore・Cloud Storage を使用します。独自バックエンドはありません。

キット一覧（カード／リスト）、任意のキット画像、ランナー・成形色、塗装グループ、塗装工程・順序変更、使用塗料・混色、工程前のマスキング注意、保有塗料・原液の瓶・希釈済み本数、検索・在庫絞り込み、塗料の論理削除・復元を備えています。

設計の基準は [設計書](plam-plan_設計書.md)、開発ルールは [AGENTS.md](AGENTS.md) です。設計書に残るログイン方式の不一致は、利用者の指定により **Google 認証**を採用しました。提案されている件数・文字数・500KiBの保存上限と、グループ名の一意制約も利用者の指定により採用しています。

## ローカル開発

Node.js **24.19.0**、npm、Java **21以上**（Emulator検証用）が必要です。

```sh
npm ci
cp .env.example .env.local
# .env.local に Firebase Web 設定と VITE_ALLOWED_UID を記入
npm run dev
```

開発サーバーは `/plam-plan/` で動作します。ルートは `#/kits/<id>` などのハッシュ形式で、GitHub Pages上の詳細URL再読み込みに対応します。Firebase未設定でも説明画面を表示しますが、データの登録・閲覧には設定が必要です。ダミーデータを本番アプリに保存する機能はありません。

`.env.local` はGit管理から除外されます。`VITE_` 設定はブラウザから読める公開情報です。サービスアカウント秘密鍵や管理用認証情報を記入しないでください。

## Firebase の初期設定

1. 開発用Firebaseプロジェクトを用意し、Webアプリを登録します。Web設定を `.env.local` に設定します。
2. AuthenticationのGoogleプロバイダーを有効にし、本人のGoogleアカウントをFirebase Authenticationへ登録します。本人のUIDを `VITE_ALLOWED_UID` に設定します。UIでは新規アカウント登録を提供しません。Google OAuthで他人の認証ユーザーが生成されても、本人以外のアプリ利用とデータアクセスは拒否されます。
3. FirestoreとStorageを有効にします。Storageの利用にはBlazeプランと請求先の設定が必要です。
4. **同じ本人UID**をRulesへ設定して配備します。リポジトリのRulesはプレースホルダーのままでは全アクセスを拒否します。

```sh
FIREBASE_ALLOWED_UID='<本人のUID>' npm run rules:prepare
# firebase login 等で開発者自身のCLI権限を準備
npx firebase deploy --config firebase.runtime.json --project <project-id> --only firestore:rules,firestore:indexes,storage
```

生成したRulesと `firebase.runtime.json` はGit管理から除外します。認証情報はコードやチャットへ貼り付けないでください。Rulesの配備はGitHub Pagesの配備とは別です。

Authenticationの承認済みドメインに開発ホストと `begai-003.github.io` を追加します。Firebase SDKによる認証付き画像のBlob取得にはStorageバケットのCORSも必要です。Google Cloudの権限を持つ運用者が、許可するアプリの配信元だけを指定してください。

```sh
# storage.cors.example.json のローカル用originを本番では削除するなど、運用に合わせて確認
# バケット名は Firebase Console の実際の値を使う
gcloud storage buckets update gs://<bucket-name> --cors-file=storage.cors.example.json
```

## テスト

```sh
npm test                       # 機能別の業務ルール・保存処理・画像交換・競合検証
npm run test:rules             # 実際のFirestore/Storage EmulatorでRules検証
npx playwright install chromium
npm run test:e2e               # Auth/Firestore/Storage Emulator + Chromiumで画面操作
npm run build                 # 本番ビルド
```

`test:e2e` は架空のGoogle IDトークンを受け付ける公式Auth Emulatorの `signInWithCredential` を使用します。本番アプリにはテスト用ログイン経路がありません。実際のGoogleポップアップフローを検証する場合は `TEST_OAUTH_POPUP=true npm run test:e2e` を実行してください。この検証には `apis.google.com` 等への通信が必要です。Emulatorのデータはテスト専用で、終了時に破棄されます。

システムのChromiumを使う場合は `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e` を使用できます。Emulatorのダウンロードキャッシュは `.runtime/emulator-cache`、Firebase CLI設定は `.runtime/firebase-config` に保存します。既存キャッシュを再利用する場合は `FIREBASE_EMULATORS_PATH` を指定できます。

手動のEmulator開発では `.env.local` に `VITE_USE_EMULATORS=true` と `demo-plam-plan` のWeb設定を指定し、本人UIDを設定した `firebase.runtime.json` で `npx firebase emulators:start --config firebase.runtime.json --project demo-plam-plan` を実行してください。Google認証のテストアカウントUIDとRules・UI設定のUIDを揃えます。本番用 `.env.local` と混同しないでください。

## GitHub Pages

Viteのbaseは `/plam-plan/` です。GitHub ActionsはPR・mainへのpushで検証し、Pages公開は手動実行で行います。リポジトリSettingsのPagesをGitHub Actionsに設定し、次のRepository Variablesを登録してください。

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_APP_ID`
- `VITE_ALLOWED_UID`

**本番Rulesの配備、承認済みドメイン、CORSを確認してから** Publish workflowを実行してください。このリポジトリを別名へ変更する場合はViteのbaseと公開ホストの設定を合わせて変更します。CIの検証が成功したことだけでは、本番のFirebase設定や実際のブラウザ・OSでの確認が済んだことにはなりません。

## 保存と運用

`users/{uid}/kits/{kitId}` にキット全体、`users/{uid}/paints/{paintId}` に塗料台帳を保存します。画像は `users/{uid}/kits/{kitId}/{imageId}` です。公開ダウンロードURLは保存せず、認証付きSDKで取得したBlobの一時URLを画面離脱・ログアウト時に破棄します。アプリデータはlocalStorageへ保存しません。

保存時はtransactionでrevisionを照合します。別端末で更新された場合は上書きを止め、入力を保持して再読み込みを案内します。キット削除は `deleting` にしてから画像・ドキュメントを削除し、途中で失敗しても一覧から再試行できます。塗料は論理削除し、既存工程の参照を残します。

画像交換は新画像をアップロードしてからDBを更新し、最後に旧画像を削除します。旧画像の削除失敗はそのセッション中に記録し、再試行ボタンを表示します。タブを閉じた場合や通信結果が不明のまま中断した場合の孤立画像は、Firebase Consoleでキットの `imagePath` とStorage配下を照合し、**どのキットからも参照されていない画像だけ**を運用者が削除します。結果不明時にアプリは画像を勝手に削除しません。キット削除の再試行ではキット配下の画像をすべて削除します。

Rulesは本人UID、パス、トップレベルの許可フィールド・型・件数・時刻・revision・削除状態、および画像サイズ・MIMEを検証します。埋め込み配列の全要素の型、固定IDの参照整合性、混色の合計、瓶ラベルの一意性などはクライアントで検証します。Firestore Rulesには一般的なループがないため、これらの完全な検証はRulesに実装していません。許可された本人がSDKを直接操作すれば、その業務検証を迂回できます。本人以外のアクセスはRulesで拒否します。バックアップ機能は設計どおり初期版に含めません。

検証結果と未検証の範囲は [検証記録](docs/verification.md) を参照してください。
