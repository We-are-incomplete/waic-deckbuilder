/**
 * spec: メモ化キー生成とインデックスキャッシュのユーティリティ。
 * 同期・純粋な関数で構成し、副作用は内部に閉じ込める。
 */

import { ref, type Ref } from "vue";
import { useMemoize } from "@vueuse/core";
import { Effect } from "effect";

let unserializableCounter = 0;
const unserializableKeyMap = new WeakMap<object, string>();
const symbolKeyMap = new Map<symbol, string>();

/**
 * 安全に基準値をシリアライズし、失敗時はフォールバックキーを返す
 */
function safeCriteriaSerialize<C>(criteria: C): string {
  const serialized = Effect.runSync(
    Effect.match(
      Effect.try({
        try: () => JSON.stringify(criteria),
        catch: () => null,
      }),
      {
        onSuccess: (s) => s,
        onFailure: () => null,
      },
    ),
  );
  if (typeof serialized === "string") return serialized;
  // オブジェクト/関数は恒等で安定化
  if (
    criteria &&
    (typeof criteria === "object" || typeof criteria === "function")
  ) {
    let key = unserializableKeyMap.get(criteria as object);
    if (!key) {
      key = `<UNSERIALIZABLE_CRITERIA_${++unserializableCounter}>`;
      unserializableKeyMap.set(criteria as object, key);
    }
    return key;
  }
  // プリミティブ等の安定化
  if (typeof criteria === "bigint") {
    return `bigint:${criteria.toString()}`;
  }
  if (typeof criteria === "symbol") {
    let key = symbolKeyMap.get(criteria);
    if (!key) {
      key = `<SYMBOL_${++unserializableCounter}>`;
      symbolKeyMap.set(criteria, key);
    }
    return key;
  }
  if (typeof criteria === "undefined") {
    return "undefined";
  }
  return `<UNSERIALIZABLE_CRITERIA_${++unserializableCounter}>`;
}

/**
 * バージョン管理機能付きのストア状態
 */
export interface VersionedState {
  version: Ref<number>;
  incrementVersion: () => void;
}

/**
 * バージョン管理機能を作成
 */
export function createVersionedState(): VersionedState {
  const version = ref(0);

  const incrementVersion = () => {
    version.value++;
  };

  return {
    version,
    incrementVersion,
  };
}

/**
 * 配列のユニークキー生成（WeakMapベース）
 */
export const createArrayKeyGenerator = () => {
  const arrayMemoIds = new WeakMap<readonly unknown[], string>();
  let uniqueKeyCounter = 0;
  return {
    generateKey<T>(array: readonly T[]): string {
      const existing = arrayMemoIds.get(array);
      if (existing) return existing;
      const memoId = `array_key_${++uniqueKeyCounter}`;
      arrayMemoIds.set(array, memoId);
      return memoId;
    },
  };
};

/**
 * 共通のメモ化された検索関数ファクトリ
 */
export function createMemoizedFunction<TInput, TOutput>(
  fn: (input: TInput) => TOutput,
  keyGenerator: (input: TInput) => string,
) {
  return useMemoize(fn, {
    getKey: keyGenerator,
  });
}

/**
 * バージョン付きメモ化関数ファクトリ
 */
export function createVersionedMemoizedFunction<TInput, TOutput>(
  fn: (input: TInput) => TOutput,
  keyGenerator: (input: TInput, version: number) => string,
  versionRef: Ref<number>,
) {
  return useMemoize(fn, {
    getKey: (input: TInput) => keyGenerator(input, versionRef.value),
  });
}

/**
 * Set ベースのインデックスキャッシュマネージャーを生成する関数
 */
export function createIndexCacheManager<K, V>() {
  const cache = new Map<K, Set<V>>();

  return {
    addToIndex(key: K, value: V): void {
      let set = cache.get(key);
      if (!set) {
        set = new Set();
        cache.set(key, set);
      }
      set.add(value);
    },

    removeFromIndex(key: K, value: V): boolean {
      const set = cache.get(key);
      return set ? set.delete(value) : false;
    },

    getFromIndex(key: K): Set<V> | undefined {
      return cache.get(key);
    },

    // 内部状態を守りたい場合のスナップショット取得用
    getFromIndexSnapshot(key: K): ReadonlySet<V> | undefined {
      const set = cache.get(key);
      return set ? new Set(set) : undefined;
    },

    hasIndex(key: K): boolean {
      return cache.has(key);
    },

    hasValue(key: K, value: V): boolean {
      const set = cache.get(key);
      return !!set && set.has(value);
    },

    clearIndex(): void {
      cache.clear();
    },

    deleteIndex(key: K): boolean {
      return cache.delete(key);
    },

    get size(): number {
      return cache.size;
    },
  };
}

/**
 * 事前定義されたヘルパー関数
 */

// 配列のソート用メモ化関数
export const createArraySortMemo = <T>(
  sortFn: (array: readonly T[]) => readonly T[],
) => {
  const keyGen = createArrayKeyGenerator();
  return createMemoizedFunction(sortFn, (array) => keyGen.generateKey(array));
};

// テキスト検索用メモ化関数
export const createSearchMemo = <T>(
  searchFn: (items: readonly T[], query: string) => readonly T[],
  versionRef: Ref<number>,
) => {
  const keyGen = createArrayKeyGenerator();
  const memoized = createVersionedMemoizedFunction(
    ({ items, query }: { items: readonly T[]; query: string }) =>
      searchFn(items, query),
    ({ items, query }, version) =>
      `${keyGen.generateKey(items)}_${query}_v${version}`,
    versionRef,
  );
  return (items: readonly T[], query: string) => memoized({ items, query });
};

// フィルタリング用メモ化関数
export const createFilterMemo = <T, C>(
  filterFn: (items: readonly T[], criteria: C) => readonly T[],
) => {
  const keyGen = createArrayKeyGenerator();
  return createMemoizedFunction(
    ({ items, criteria }: { items: readonly T[]; criteria: C }) =>
      filterFn(items, criteria),
    ({ items, criteria }) =>
      `${keyGen.generateKey(items)}_${safeCriteriaSerialize(criteria)}`,
  );
};
