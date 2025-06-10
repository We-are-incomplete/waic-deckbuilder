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
  readonly accessCount: number;
}

// 効率的なハッシュ関数
const fastHash = (str: string): string => {
  let hash = 0;
  if (str.length === 0) return hash.toString();

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // 32bit整数に変換
  }

  return hash.toString();
};

// デフォルトのキーシリアライザー（改善版）
const defaultKeySerializer = (args: readonly unknown[]): string => {
  if (args.length === 0) return "empty";
  if (args.length === 1) {
    const arg = args[0];
    if (typeof arg === "string") return fastHash(arg);
    if (typeof arg === "number") return arg.toString();
    if (typeof arg === "boolean") return arg.toString();
  }

  try {
    return fastHash(JSON.stringify(args));
  } catch {
    // JSONシリアライズできない場合は効率的な文字列化
    return fastHash(
      args
        .map((arg) => {
          if (arg === null) return "null";
          if (arg === undefined) return "undefined";
          if (typeof arg === "object")
            return `[object ${arg.constructor?.name || "Object"}]`;
          return String(arg);
        })
        .join(",")
    );
  }
};

/**
 * 純粋関数をメモ化する高階関数（改善版）
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
  let accessOrder: string[] = []; // LRU追跡用
  let totalCalls = 0; // 総呼び出し数
  let cacheHits = 0; // キャッシュヒット数

  const memoizedFunction = (...args: TArgs): TReturn => {
    totalCalls++;
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
        const index = accessOrder.indexOf(key);
        if (index !== -1) {
          accessOrder.splice(index, 1);
        }
      } else {
        // キャッシュヒット
        cacheHits++;

        // アクセス順序を更新（LRU）
        const index = accessOrder.indexOf(key);
        if (index !== -1) {
          accessOrder.splice(index, 1);
        }
        accessOrder.push(key);

        // アクセス回数を増加（統計用）
        cache.set(key, {
          ...cached,
          accessCount: cached.accessCount + 1,
        });

        return cached.value;
      }
    }

    // 関数の実行
    const result = fn(...args);

    // キャッシュサイズの制限チェック
    if (cache.size >= maxSize) {
      // LRU: 最も使用頻度が低く、古いエントリを削除
      let oldestKey = accessOrder[0];
      if (oldestKey) {
        cache.delete(oldestKey);
        accessOrder.shift();
      }
    }

    // 結果をキャッシュに保存
    cache.set(key, {
      value: result,
      timestamp: now,
      accessCount: 1,
    });

    accessOrder.push(key);

    return result;
  };

  // メモ化関数にユーティリティメソッドを追加
  Object.assign(memoizedFunction, {
    cache: {
      clear: () => {
        cache.clear();
        accessOrder = [];
        totalCalls = 0;
        cacheHits = 0;
      },
      delete: (key: string) => {
        const deleted = cache.delete(key);
        if (deleted) {
          const index = accessOrder.indexOf(key);
          if (index !== -1) {
            accessOrder.splice(index, 1);
          }
        }
        return deleted;
      },
      has: (key: string) => cache.has(key),
      size: () => cache.size,
      entries: () => Array.from(cache.entries()),
      stats: () => ({
        size: cache.size,
        hitRate: totalCalls > 0 ? cacheHits / totalCalls : 0,
        totalCalls,
        cacheHits,
        averageAccessCount:
          cache.size > 0
            ? Array.from(cache.values()).reduce(
                (sum, entry) => sum + entry.accessCount,
                0
              ) / cache.size
            : 0,
      }),
    },
  });

  return ok(memoizedFunction);
};

/**
 * 配列に対する計算のメモ化（配列の内容でキーを生成、改善版）
 */
export const memoizeArrayComputation = <TItem, TReturn>(
  fn: (items: readonly TItem[]) => TReturn,
  options: Omit<MemoizationOptions, "keySerializer"> = {}
): Result<(items: readonly TItem[]) => TReturn, MemoizationError> => {
  const arrayKeySerializer = (args: readonly unknown[]): string => {
    const items = args[0] as readonly TItem[];
    if (!Array.isArray(items)) {
      // エラーをthrowする代わりに、安定したデフォルトキーを返す
      return "invalid-array-input";
    }

    // 配列の長さが小さい場合は全体をハッシュ化
    if (items.length <= 10) {
      try {
        return fastHash(JSON.stringify(items));
      } catch {
        return fastHash(
          `length:${items.length},items:${items.map(String).join(",")}`
        );
      }
    }

    // 大きな配列の場合は効率的なフィンガープリント生成
    try {
      const fingerprint = {
        length: items.length,
        first: items[0],
        middle: items[Math.floor(items.length / 2)],
        last: items[items.length - 1],
        checksum: items.reduce((sum, item, index) => {
          // 簡単なチェックサムを計算
          const str = String(item);
          return sum + str.length * (index + 1);
        }, 0),
      };
      return fastHash(JSON.stringify(fingerprint));
    } catch {
      // JSONシリアライズできない場合は長さベースのキー
      return fastHash(`length:${items.length},type:${typeof items[0]}`);
    }
  };

  return memoize(fn, {
    ...options,
    keySerializer: arrayKeySerializer,
  });
};

/**
 * オブジェクトに対する計算のメモ化（オブジェクトのプロパティでキーを生成、改善版）
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
      // エラーをthrowする代わりに、安定したデフォルトキーを返す
      return "invalid-object-input";
    }

    // オブジェクトの効率的なフィンガープリント生成
    try {
      const keys = Object.keys(obj);
      const sortedKeys = keys.sort();

      // 小さなオブジェクトは全体をハッシュ化
      if (sortedKeys.length <= 5) {
        const keyValuePairs = sortedKeys.map(
          (key) => `${key}:${JSON.stringify(obj[key])}`
        );
        return fastHash(keyValuePairs.join("|"));
      }

      // 大きなオブジェクトは重要なプロパティのみでフィンガープリント生成
      const fingerprint = {
        keyCount: sortedKeys.length,
        keyHash: fastHash(sortedKeys.join(",")),
        sampleValues: sortedKeys.slice(0, 3).map((key) => obj[key]),
      };
      return fastHash(JSON.stringify(fingerprint));
    } catch {
      // JSONシリアライズできない場合はオブジェクトの構造情報を使用
      const keys = Object.keys(obj);
      return fastHash(`object-keys:${keys.length},first:${keys[0] || ""}`);
    }
  };

  return memoize(fn, {
    ...options,
    keySerializer: objectKeySerializer,
  });
};

/**
 * WeakMapベースの軽量メモ化（オブジェクト参照用）
 */
export const createWeakMemoization = <TKey extends WeakKey, TValue>(
  fn: (key: TKey) => TValue
): ((key: TKey) => TValue) => {
  const cache = new WeakMap<TKey, TValue>();

  return (key: TKey): TValue => {
    if (cache.has(key)) {
      return cache.get(key)!;
    }

    const result = fn(key);
    cache.set(key, result);
    return result;
  };
};
