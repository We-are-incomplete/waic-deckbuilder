# 関数型ドメインモデリング

TypeScript で関数型ドメインモデリングを行う。class を使わず関数による実装を優先する。
代数的データでドメインをモデリングする。

- 純粋関数を優先
- 不変データ構造を使用
- 副作用を分離
- 型安全性を確保
- 値オブジェクトとエンティティを区別
- 集約で整合性を保証
- リポジトリでデータアクセスを抽象化
- 境界付けられたコンテキストを意識

# コメントによる自己記述

各ファイルの冒頭にはコメントで仕様を記述する。

# 早期リターンパターンを使用して可読性を向上させる

- `else`文による深いネストを避ける。
- エラーケースを先に早期リターンで処理する。

# 単一責任と API の最小化

- ファイルは責務ごとに分割し、各ファイルが単一の責務を持つようにする。
- 公開 API は最小限に保ち、実装の詳細は隠蔽する。
- モジュールの境界と依存関係を最小化する。

# Common Commands

- `pnpm build` - Build the project
- `pnpm lint` - Run linter
- `pnpm typecheck` - Type check with vue-tsc
- `pnpm format` - Format code with Prettier

# Semantic Commit Messages

Format: `<type>(<scope>): <subject>`

`<subject>` is written in Japanese.

Type Examples:

- `feat`: (new feature for the user, not a new feature for build script)
- `fix`: (bug fix for the user, not a fix to a build script)
- `docs`: (changes to the documentation)
- `style`: (formatting, missing semi colons, etc; no production code change)
- `refactor`: (refactoring production code, eg. renaming a variable)
- `test`: (adding missing tests, refactoring tests; no production code change)
- `chore`: (updating grunt tasks etc; no production code change)

# Effect ライブラリ使用方針

`Effect`は、TypeScriptの型システムを最大限に活用し、堅牢で保守性の高いアプリケーションを構築するためのエコシステムです。

## 1\. 基本原則：型システムによる副作用の管理

`Effect`の最も重要な思想は、**成功値だけでなく、起こりうるエラー（`E`）と必要な依存関係（`R`）も型システムで追跡する**ことです。

```typescript
// Effect<A, E, R>
// A: 成功値の型
// E: エラーの型
// R: 依存関係（サービス）の型
```

これにより、関数のシグネチャを見るだけで、その処理が何を行い、何に失敗する可能性があり、何に依存しているのかが明確になります。

**方針:**

- 従来の`throw`による例外処理を避け、`Effect.fail`や`Effect.die`を用いてエラーを`Effect`の値として扱います。
- 関数の依存関係は引数で渡すのではなく、`Context`と`Layer`を用いて`R`型パラメータで管理します。

## 2\. コーディングスタイル

一貫性のあるコーディングスタイルは、コードの可読性と保守性を向上させます。

### 2.1. `Effect.gen`による命令的な記述

`async/await`に似た直感的なスタイルでコードを記述できる`Effect.gen`（ジェネレータ関数）の利用を第一に推奨します。これにより、ネストが深くなるのを防ぎ、通常の同期コードのように処理の流れを記述できます。

```typescript
import { Effect, Console } from "effect";

// Effect.gen を使った推奨スタイル
const program = Effect.gen(function* () {
  yield* Console.log("Hello");
  const a = yield* Effect.succeed(1);
  const b = yield* Effect.succeed(2);
  yield* Console.log(`Result: ${a + b}`);
});
```

### 2.2. `pipe`による関数合成

`Effect.gen`が使えない場合や、単純な処理の連鎖には`pipe`関数を利用します。これにより、処理の流れが左から右へと自然に読めるようになります。

```typescript
import { Effect, Console, pipe } from "effect";

const program = pipe(
  Console.log("Hello"),
  Effect.andThen(() => Effect.succeed(1)),
  Effect.andThen((n) => Console.log(`Got: ${n}`)),
);
```

> **Note:** `effect`が提供するデータ型には`.pipe()`メソッドも生えていますが、一貫性のために`pipe`関数をインポートして使用することを推奨します。

### 2.3. ポイントフリースタイル（暗黙的な関数呼び出し）の回避

型推論の問題やスタックトレースの不明瞭さを避けるため、以下のようなポイントフリースタイルは避け、明示的なラムダ式を使用してください。

```typescript
// 避けるべきスタイル
Effect.map(myFunction);

// 推奨されるスタイル
Effect.map((x) => myFunction(x));
```

## 3\. Effectの実行

`Effect`は遅延評価されるため、実行するには`run*`系の関数が必要です。

**方針:**

- `run*`系の関数は、アプリケーションのエントリーポイントなど、\*\*プログラムの境界（Edge）\*\*でのみ呼び出します。アプリケーションのコアロジックは`Effect`型の値として合成していくべきです。
- Node.js環境では、`CTRL+C`などによるシグナルを適切に処理し、リソースを安全に解放するために`NodeRuntime.runMain`を使用します。
- 非同期処理を含む可能性がある場合は、原則として`Effect.runPromise`や`Effect.runFork`を使用します。`Effect.runSync`は、非同期処理が含まれないことが確実な場合にのみ限定的に使用します。

## 4\. エラーハンドリング戦略

`Effect`はエラーを2種類に分類して扱います。

### 4.1. 予測されるエラー (Expected Errors / Failures)

ビジネスロジック上、発生しうると予測される回復可能なエラーです（例: APIリクエストの失敗、バリデーションエラー）。

**方針:**

- `Effect.fail`で発生させ、`E`型パラメータで追跡します。
- 識別のために、`Data.TaggedError`を継承したカスタムエラークラスを作成することを強く推奨します。これにより、`catchTag`やパターンマッチングで特定のエラーを安全に処理できます。
- エラーからの回復には`Effect.catchAll`や`Effect.catchTag`、エラーを値として扱いたい場合は`Effect.either`を使用します。
- 複数の処理で発生しうる全てのエラーを集約したい場合は、デフォルトの"fail-fast"動作ではなく`Effect.validateAll`や`Effect.partition`を検討します。

### 4.2. 予測されないエラー (Unexpected Errors / Defects)

プログラムのバグなど、本来発生すべきではない回復不能なエラーです。

**方針:**

- `Effect.die`で発生させます。これは`E`型パラメータでは追跡されません。
- 原則として`Defect`はアプリケーションロジック内で**キャッチすべきではありません**。アプリケーションの最上位（エントリーポイント）でロギングするなどの目的でのみ`catchAllCause`などを使って捕捉します。

## 5\. 依存性の管理 (DI)

サービスの依存関係は`Layer`を用いて管理します。これにより、実装の詳細をインターフェースから分離できます。

**方針:**

- サービスのインターフェースは`Context.Tag`を用いて定義します。
- サービスの具体的な実装は`Layer`として定義します。サービスが他のサービスに依存する場合、その依存関係は`Layer`の`RequirementsIn`（第3型引数）で表現されます。
- アプリケーションコードで利用する具体的なサービス（例: 本番用DBクライアント）は、ボイラープレートを削減できる`Effect.Service`を使って定義することを推奨します。
- `Layer`は参照によってメモ化されます。同じ`Layer`インスタンスを複数回`provide`しても、構築処理は一度しか実行されません。毎回新しいインスタンスが必要な場合は`Layer.fresh`を使用します。

## 6\. リソース管理

ファイルハンドルやDBコネクションなど、解放が必要なリソースは`Scope`を用いて安全に管理します。

**方針:**

- リソースの取得と解放は`Effect.acquireUseRelease`または`Effect.scoped`内で`Effect.acquireRelease`を用いて定義します。これにより、処理の成功、失敗、中断にかかわらず、解放処理が必ず実行されることが保証されます。
- `Effect.addFinalizer`や`Effect.onExit`を使うことで、スコープ終了時のクリーンアップ処理を追加できます。

## 7\. 状態管理

アプリケーション内の可変状態は`Ref`を用いて管理します。

**方針:**

- 単純なアトミックな更新には`Ref`を使用します。
- 状態の更新に副作用（例: API呼び出し）が伴う場合は`SynchronizedRef`を使用します。
- 状態の変更をストリームとして購読し、複数のコンシューマに配信したい場合は`SubscriptionRef`を使用します。

## 8\. データ構造とバリデーション

### 8.1. Effectのデータ構造

**方針:**

- 値に基づいた等価性比較が必要な場合は、JavaScript標準の`{}`や`[]`の代わりに`Data.struct`や`Data.array`、`HashSet`を使用します。
- `null`や`undefined`が許容される値は`Option`型で表現します。
- 成功または失敗のいずれかの結果を表す値には`Either`型を使用します。

### 8.2. `effect/Schema`によるバリデーション

外部から受け取る未知のデータ（APIレスポンス、ユーザー入力など）は、`effect/Schema`を使ってバリデーションと型変換を行うことを強く推奨します。

**方針:**

- `Schema.Struct`や`Schema.Class`でデータの構造を定義します。
- `Schema.decodeUnknown*`系の関数を使って、安全に`unknown`型の値をパースします。
- `Schema.transform`やフィルタ (`minLength`, `pattern`など) を活用して、データの変換とバリデーションを宣言的に記述します。

## 9\. 可観測性 (Observability)

**方針:**

- **ロギング:** `console.log`の代わりに`Effect.log`を使用します。これにより、ログレベル、Fiber ID、スパンなどの構造化された情報が付与され、ログのフィルタリングや分析が容易になります。
- **トレーシング:** パフォーマンス分析やデバッグのために、主要な処理のまとまりを`Effect.withSpan`で囲み、トレーススパンを生成します。
- **メトリクス:** リクエスト数やレイテンシなどの定量的なデータを収集するには`Metric`を利用します。
