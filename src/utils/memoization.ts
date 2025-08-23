import { ref, type Ref } from "vue";
import { useMemoize } from "@vueuse/core";

/**
 * 共通のメモ化とキャッシュユーティリティ
 */

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
export class ArrayKeyGenerator {
  private arrayMemoIds = new WeakMap<readonly any[], string>();
  private uniqueKeyCounter = 0;

  generateKey<T>(array: readonly T[]): string {
    let memoId = this.arrayMemoIds.get(array);
    if (!memoId) {
      memoId = `array_key_${++this.uniqueKeyCounter}`;
      this.arrayMemoIds.set(array, memoId);
    }
    return memoId;
  }
}

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
  return useMemoize(
    (input: TInput) => fn(input),
    {
      getKey: (input: TInput) => keyGenerator(input, versionRef.value),
    },
  );
}



/**
 * Set ベースのインデックスキャッシュマネージャー
 */
export class IndexCacheManager<K, V> {
  private cache: Map<K, Set<V>>;

  constructor() {
    this.cache = new Map();
  }

  addToIndex(key: K, value: V): void {
    let set = this.cache.get(key);
    if (!set) {
      set = new Set();
      this.cache.set(key, set);
    }
    set.add(value);
  }

  getFromIndex(key: K): Set<V> | undefined {
    return this.cache.get(key);
  }

  hasIndex(key: K): boolean {
    return this.cache.has(key);
  }

  clearIndex(): void {
    this.cache.clear();
  }

  deleteIndex(key: K): boolean {
    return this.cache.delete(key);
  }

  get size(): number {
    return this.cache.size;
  }
}

/**
 * 事前定義されたヘルパー関数
 */

// 配列のソート用メモ化関数
export const createArraySortMemo = <T>(
  sortFn: (array: readonly T[]) => readonly T[],
) => {
  const keyGen = new ArrayKeyGenerator();
  return createMemoizedFunction(sortFn, (array) => keyGen.generateKey(array));
};

// テキスト検索用メモ化関数  
export const createSearchMemo = <T>(
  searchFn: (items: readonly T[], query: string) => readonly T[],
  versionRef: Ref<number>,
) => {
  return createVersionedMemoizedFunction(
    ({ items, query }: { items: readonly T[]; query: string }) =>
      searchFn(items, query),
    ({ query }, version) => `${query}_v${version}`,
    versionRef,
  );
};

// フィルタリング用メモ化関数
export const createFilterMemo = <T, C>(
  filterFn: (items: readonly T[], criteria: C) => readonly T[],
) => {
  const keyGen = new ArrayKeyGenerator();
  return createMemoizedFunction(
    ({ items, criteria }: { items: readonly T[]; criteria: C }) =>
      filterFn(items, criteria),
    ({ items, criteria }) =>
      `${keyGen.generateKey(items)}_${JSON.stringify(criteria)}`,
  );
};
