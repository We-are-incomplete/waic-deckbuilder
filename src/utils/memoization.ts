import { ok, err, type Result } from "neverthrow";

// メモ化エラー型
export type MemoizationError =
  | { readonly type: "invalidFunction"; readonly message: string }
  | { readonly type: "serializationError"; readonly message: string }
  | { readonly type: "memoryLimitExceeded"; readonly maxSize: number };

// メモ化設定
export interface MemoizationOptions {
  readonly maxSize?: number;
  readonly ttl?: number; // Time To Live in milliseconds
  readonly keySerializer?: (args: readonly unknown[]) => string;
}

// メモ化キャッシュエントリ
interface CacheEntry<T> {
  readonly value: T;
  readonly timestamp: number;
}

// デフォルトのキーシリアライザー
const defaultKeySerializer = (args: readonly unknown[]): string => {
  try {
    return JSON.stringify(args);
  } catch {
    // JSONシリアライズできない場合は文字列化
    return args.map((arg) => String(arg)).join(",");
  }
};

/**
 * 純粋関数をメモ化する高階関数
 */
export const memoize = <TArgs extends readonly unknown[], TReturn>(
  fn: (...args: TArgs) => TReturn,
  options: MemoizationOptions = {}
): Result<(...args: TArgs) => TReturn, MemoizationError> => {
  // 関数の検証
  if (typeof fn !== "function") {
    return err({
      type: "invalidFunction",
      message: "メモ化対象は関数である必要があります",
    });
  }

  const { maxSize = 100, ttl, keySerializer = defaultKeySerializer } = options;

  const cache = new Map<string, CacheEntry<TReturn>>();

  const memoizedFunction = (...args: TArgs): TReturn => {
    // キーの生成
    let key: string;
    try {
      key = keySerializer(args);
    } catch {
      return fn(...args); // シリアライズに失敗した場合は元の関数を実行
    }

    const now = Date.now();

    // キャッシュの確認
    const cached = cache.get(key);
    if (cached) {
      // TTLのチェック
      if (ttl && now - cached.timestamp > ttl) {
        cache.delete(key);
      } else {
        return cached.value;
      }
    }

    // 関数の実行
    const result = fn(...args);

    // キャッシュサイズの制限チェック
    if (cache.size >= maxSize) {
      // LRU: 最も古いエントリを削除
      const oldestKey = cache.keys().next().value;
      if (oldestKey) {
        cache.delete(oldestKey);
      }
    }

    // 結果をキャッシュに保存
    cache.set(key, {
      value: result,
      timestamp: now,
    });

    return result;
  };

  // メモ化関数にユーティリティメソッドを追加
  Object.assign(memoizedFunction, {
    cache: {
      clear: () => cache.clear(),
      delete: (key: string) => cache.delete(key),
      has: (key: string) => cache.has(key),
      size: () => cache.size,
      entries: () => Array.from(cache.entries()),
    },
  });

  return ok(memoizedFunction);
};

/**
 * 配列に対する計算のメモ化（配列の内容でキーを生成）
 */
export const memoizeArrayComputation = <TItem, TReturn>(
  fn: (items: readonly TItem[]) => TReturn,
  options: Omit<MemoizationOptions, "keySerializer"> = {}
): Result<(items: readonly TItem[]) => TReturn, MemoizationError> => {
  const arrayKeySerializer = (args: readonly unknown[]): string => {
    const items = args[0] as readonly TItem[];
    if (!Array.isArray(items)) {
      // エラーをthrowする代わりに、デフォルトキーを返す
      return `invalid-array-${Date.now()}`;
    }

    // 配列の内容を基にしたハッシュ生成
    try {
      return JSON.stringify(items);
    } catch {
      // JSONシリアライズできない場合は長さと一部の要素を使用
      return `length:${items.length},first:${String(items[0])},last:${String(
        items[items.length - 1]
      )}`;
    }
  };

  return memoize(fn, {
    ...options,
    keySerializer: arrayKeySerializer,
  });
};

/**
 * オブジェクトに対する計算のメモ化（オブジェクトのプロパティでキーを生成）
 */
export const memoizeObjectComputation = <
  TObject extends Record<string, unknown>,
  TReturn
>(
  fn: (obj: TObject) => TReturn,
  options: Omit<MemoizationOptions, "keySerializer"> = {}
): Result<(obj: TObject) => TReturn, MemoizationError> => {
  const objectKeySerializer = (args: readonly unknown[]): string => {
    const obj = args[0] as TObject;
    if (typeof obj !== "object" || obj === null) {
      // エラーをthrowする代わりに、デフォルトキーを返す
      return `invalid-object-${Date.now()}`;
    }

    // オブジェクトの安定したキー生成
    try {
      const sortedKeys = Object.keys(obj).sort();
      const keyValuePairs = sortedKeys.map(
        (key) => `${key}:${JSON.stringify(obj[key])}`
      );
      return keyValuePairs.join("|");
    } catch {
      // JSONシリアライズできない場合はオブジェクトの型とキー数を使用
      return `object-keys:${Object.keys(obj).length}`;
    }
  };

  return memoize(fn, {
    ...options,
    keySerializer: objectKeySerializer,
  });
};
