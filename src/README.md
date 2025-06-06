# Src フォルダ構造ドキュメント

このドキュメントでは、リファクタリング後の src フォルダの構造と設計思想について説明します。

## フォルダ構造

```
src/
├── components/          # Vueコンポーネント
│   ├── layout/         # レイアウト関連コンポーネント
│   ├── modals/         # モーダル関連コンポーネント
│   └── ui/             # 再利用可能なUIコンポーネント
├── composables/        # Vue Composition API関数群
├── constants/          # 定数定義（機能別に分割）
│   ├── export/         # エクスポート関連設定
│   ├── game/           # ゲームルール・カード定義
│   └── storage/        # ローカルストレージキー
├── stores/             # Pinia/Vuex状態管理（将来的な拡張用）
├── types/              # TypeScript型定義（ドメイン別）
│   ├── card/           # カード関連型
│   ├── deck/           # デッキ関連型
│   ├── export/         # エクスポート関連型
│   └── filter/         # フィルター関連型
├── utils/              # ユーティリティ関数
├── views/              # ページコンポーネント（将来的な拡張用）
│   └── pages/
├── App.vue             # メインアプリケーションコンポーネント
├── main.ts             # エントリーポイント
├── style.css           # グローバルスタイル
└── vite-env.d.ts      # Vite型定義
```

## 設計原則

### 1. 関心の分離（Separation of Concerns）

- **components**: UI ロジックとプレゼンテーション
- **composables**: ビジネスロジックと状態管理
- **utils**: 純粋関数とヘルパー
- **constants**: 設定値と定数
- **types**: 型安全性の確保

### 2. 機能別分割

- **constants**と**types**は機能・ドメイン別にサブフォルダで分割
- 関連する型定義と定数を近い場所に配置

### 3. コンポーネント階層化

- **layout**: ページレベルのレイアウトコンポーネント
- **modals**: モーダル系コンポーネント
- **ui**: 再利用可能な小さな UI コンポーネント

## 主要コンポーネント

### App.vue

- アプリケーションのルートコンポーネント
- 各 composable の統合
- 子コンポーネントへの状態の流し込み

### Layout Components

- **DeckSection**: デッキ管理セクション
- **CardListSection**: カード一覧セクション
- **DeckExportContainer**: エクスポート用コンテナ

### Modal Components

- **FilterModal**: 検索・フィルターモーダル
- **DeckCodeModal**: デッキコード入出力モーダル
- **ConfirmModal**: 確認ダイアログ

## Composables

### useCards

カード一覧の読み込みと管理

### useDeck

デッキの状態管理、カードの追加・削除、永続化

### useFilter

フィルタリング・検索機能

### useExport

PNG 画像エクスポート機能

### useToast

通知システム（成功・エラーメッセージ）

## 型システム

TypeScript 型定義は機能別に分割し、型安全性を確保：

- **Card Types**: カード、カード種別、カードタイプ
- **Deck Types**: デッキカード
- **Filter Types**: フィルタ条件
- **Export Types**: エクスポート設定

## 利点

1. **保守性**: 機能別に分割されたファイル構造により、特定機能の修正が容易
2. **再利用性**: コンポーネントと composables の分離により、ロジックの再利用が可能
3. **テスタビリティ**: 純粋関数と composables によりユニットテストが書きやすい
4. **型安全性**: 詳細な型定義により開発時のエラーを防止
5. **拡張性**: 明確な構造により新機能の追加が容易

## 今後の拡張計画

- **stores/**: Pinia 導入による状態管理の強化
- **views/pages/**: 複数ページ対応時のルーティング
- **components/ui/**: 共通 UI コンポーネントライブラリの構築
