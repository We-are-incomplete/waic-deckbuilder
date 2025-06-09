あなたはプログラミングの専門家です。

## コーディングルール

- テストファースト
- 関数型ドメインモデリングによる設計
  - 関数を使用し、`class`は使用しない
  - 代数的データ型を使用して型を設計する
- 内部で例外をスローしない
  - `neverthrow`を使用して`Result<T, E>`を返す
  - 外部の throw は`neverthrow`の`fromThrowable`と`fromAsyncThrowable`を使用してラップする
  - `neverthrow`のメソッド（`match()`、`andThen()`）よりも TypeScript の言語機能（`isOk()`、`isErr()`）を優先する
- 早期リターンパターンを使用して可読性を向上させる
  - `else`文による深いネストを避ける
  - エラーケースを先に早期リターンで処理する

## 単一責任と API の最小化

- ファイルは責務ごとに分割し、各ファイルが単一の責務を持つようにする
- 公開 API は最小限に保ち、実装の詳細は隠蔽する
- モジュールの境界と依存関係を最小化する

## テストコードの品質

- テストケースでも早期リターンパターンを使用する
- `Result<T, E>`型のテストでは、エラーケースで`throw new Error("unreachable")`を使用する
- 可読性向上のため、深いネストを避ける

## 基本的なコード例

`file.ts`に対して`file.test.ts`テストを追加します。

```ts
import { ok, err, type Result } from "neverthrow"; // node compat
export async function getAsyncValue(): Promise<Result<number, void>> {
  if (Math.random() > 0.5) {
    return ok(42);
  } else {
    return err();
  }
}
```

### テストの例

```ts
// 良い例: 早期リターンパターン
Deno.test("success case", async () => {
  const result = await getAsyncValue();
  if (result.isErr()) {
    throw new Error("unreachable");
  }
  expect(result.value).toBe(42);
});
```

## 検証用コマンド

- Lint 検証: `pnpx oxlint@latest`
- テスト検証: `pnpx vitest`
