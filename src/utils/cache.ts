/**
 * 汎用LRUキャッシュの関数型実装
 * 最近最少使用（Least Recently Used）アルゴリズムに基づくキャッシュシステム
 */

/**
 * LRUキャッシュのインターフェース
 */
export interface LRUCacheInterface<K, V> {
  get(key: K): V | undefined;
  set(key: K, value: V): void;
  has(key: K): boolean;
  delete(key: K): boolean;
  clear(): void;
  size(): number;
  maxCacheSize(): number;
  usageRatio(): number;
  keys(): IterableIterator<K>;
  values(): IterableIterator<V>;
  entries(): IterableIterator<[K, V]>;
}

/**
 * LRUキャッシュの内部状態
 */
interface LRUCacheState<K, V> {
  readonly cache: Map<K, V>;
  readonly maxSize: number;
}

/**
 * キャッシュから値を取得し、使用順序を更新する純粋関数
 */
const getCacheValue = <K, V>(
  state: LRUCacheState<K, V>,
  key: K,
): V | undefined => {
  if (state.cache.has(key)) {
    const value = state.cache.get(key) as V; // has により存在は保証
    // 最後に使用されたものとして移動
    state.cache.delete(key);
    state.cache.set(key, value);
    return value;
  }
  return undefined;
};

/**
 * キャッシュに値を設定し、サイズ制限を管理する純粋関数
 */
const setCacheValue = <K, V>(
  state: LRUCacheState<K, V>,
  key: K,
  value: V,
): void => {
  if (state.cache.has(key)) {
    // 既存のキーの場合は削除してから再設定
    state.cache.delete(key);
  } else if (state.cache.size >= state.maxSize) {
    // サイズ制限に達している場合、最も古いエントリを削除
    const firstKey = state.cache.keys().next().value;
    if (firstKey !== undefined) {
      state.cache.delete(firstKey);
    }
  }
  state.cache.set(key, value);
};

/**
 * 指定されたキーが存在するかチェックする純粋関数
 */
const hasCacheKey = <K, V>(state: LRUCacheState<K, V>, key: K): boolean => {
  return state.cache.has(key);
};

/**
 * 指定されたキーのエントリを削除する純粋関数
 */
const deleteCacheEntry = <K, V>(
  state: LRUCacheState<K, V>,
  key: K,
): boolean => {
  return state.cache.delete(key);
};

/**
 * キャッシュをクリアする純粋関数
 */
const clearCache = <K, V>(state: LRUCacheState<K, V>): void => {
  state.cache.clear();
};

/**
 * 関数型アプローチによるLRUキャッシュファクトリー
 */
export const createLRUCache = <K, V>(
  maxSize: number = 100,
): LRUCacheInterface<K, V> => {
  // 容量は 1 以上の整数に正規化（NaN/Infinity/負数対策）
  const normalizedMaxSize =
    Number.isFinite(maxSize) && maxSize >= 1 ? Math.floor(maxSize) : 1;
  const state: LRUCacheState<K, V> = {
    cache: new Map<K, V>(),
    maxSize: normalizedMaxSize,
  };

  return {
    /**
     * キャッシュから値を取得し、使用順序を更新
     */
    get: (key: K) => getCacheValue(state, key),

    /**
     * キャッシュに値を設定し、サイズ制限を管理
     */
    set: (key: K, value: V) => setCacheValue(state, key, value),

    /**
     * 指定されたキーが存在するかチェック
     */
    has: (key: K) => hasCacheKey(state, key),

    /**
     * 指定されたキーのエントリを削除
     */
    delete: (key: K) => deleteCacheEntry(state, key),

    /**
     * キャッシュをクリア
     */
    clear: () => clearCache(state),

    /**
     * 現在のキャッシュサイズを取得
     */
    size: () => state.cache.size,

    /**
     * 最大キャッシュサイズを取得
     */
    maxCacheSize: () => state.maxSize,

    /**
     * キャッシュの使用率を取得（デバッグ用）
     */
    usageRatio: () => state.cache.size / state.maxSize,

    /**
     * すべてのキーを取得
     */
    keys: () => state.cache.keys(),

    /**
     * すべての値を取得
     */
    values: () => state.cache.values(),

    /**
     * すべてのエントリを取得
     */
    entries: () => state.cache.entries(),
  };
};

/**
 * 事前設定されたLRUキャッシュインスタンス（関数型アプローチ）
 */
export const createImageUrlCache = () => createLRUCache<string, string>(500);
export const createCardListCache = () => createLRUCache<string, unknown>(10);

/**
 * グローバルなキャッシュインスタンス（必要に応じて使用）
 */
export const globalImageUrlCache = createImageUrlCache();
export const globalCardListCache = createCardListCache();
