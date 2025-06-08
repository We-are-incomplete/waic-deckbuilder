# Waic Deckbuilder

## 開発環境

- Node.js v24.1.0
- pnpm 10.11.1

## インストールとセットアップ

1.  **リポジトリをクローンする**:

    ```bash
    git clone https://github.com/suika-lunch/waic-deckbuilder.git
    cd waic-deckbuilder
    ```

2.  **依存関係をインストールする**:

    ```bash
    pnpm i
    ```

3.  **開発サーバーを起動する**:
    ```bash
    pnpm dev
    ```

## 技術スタック

- Vue.js
- Vite
- TypeScript
- Tailwind CSS

## プロジェクト構造

- `public/`: 静的アセット（カード画像、カードデータなど）
- `src/`: アプリケーションのソースコード
  - `src/App.vue`: メインアプリケーションコンポーネント
  - `src/main.ts`: アプリケーションのエントリーポイント
  - `src/components/`: 再利用可能な Vue コンポーネント
  - `src/composables/`: 再利用可能な Vue Composition API 関数
  - `src/constants/`: アプリケーション全体で使用される定数
  - `src/types/`: TypeScript の型定義
  - `src/utils/`: ユーティリティ関数
