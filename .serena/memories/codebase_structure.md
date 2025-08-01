## コードベースの概略構造

- `src/App.vue`: メインのVueコンポーネント。
- `src/main.ts`: アプリケーションのエントリーポイント。
- `src/components`: Vueコンポーネント。`layout`と`modals`にサブディレクトリがある。
- `src/composables`: VueのComposables（再利用可能なロジック）。
- `src/constants`: 定義済み定数。
- `src/domain`: ドメインロジック（カード、デッキ、フィルターなど）。
- `src/stores`: Piniaストア（アプリケーションの状態管理）。
- `src/types`: TypeScriptの型定義。
- `src/utils`: ユーティリティ関数（デッキコード、エラーハンドリング、エクスポート、フィルター、画像、ロガー、ソート、ストレージなど）。
- `src/style.css`: グローバルスタイル。
- `src/vite-env.d.ts`: Vite環境の型定義。
