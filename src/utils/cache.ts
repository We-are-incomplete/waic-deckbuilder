/**
 * 汎用LRUキャッシュの実装
 * 最近最少使用（Least Recently Used）アルゴリズムに基づくキャッシュシステム
 */
export class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private readonly maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  /**
   * キャッシュから値を取得し、使用順序を更新
   */
  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // 最後に使用されたものとして移動
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  /**
   * キャッシュに値を設定し、サイズ制限を管理
   */
  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      // 既存のキーの場合は削除してから再設定
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // サイズ制限に達している場合、最も古いエントリを削除
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  /**
   * 指定されたキーが存在するかチェック
   */
  has(key: K): boolean {
    return this.cache.has(key);
  }

  /**
   * 指定されたキーのエントリを削除
   */
  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  /**
   * キャッシュをクリア
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 現在のキャッシュサイズを取得
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * 最大キャッシュサイズを取得
   */
  get maxCacheSize(): number {
    return this.maxSize;
  }

  /**
   * キャッシュの使用率を取得（デバッグ用）
   */
  get usageRatio(): number {
    return this.cache.size / this.maxSize;
  }

  /**
   * すべてのキーを取得
   */
  keys(): IterableIterator<K> {
    return this.cache.keys();
  }

  /**
   * すべての値を取得
   */
  values(): IterableIterator<V> {
    return this.cache.values();
  }

  /**
   * すべてのエントリを取得
   */
  entries(): IterableIterator<[K, V]> {
    return this.cache.entries();
  }
}

/**
 * 事前設定されたLRUキャッシュインスタンス
 */
export const createImageUrlCache = () => new LRUCache<string, string>(500);
export const createCardListCache = () => new LRUCache<string, any>(10);

/**
 * グローバルなキャッシュインスタンス（必要に応じて使用）
 */
export const globalImageUrlCache = createImageUrlCache();
export const globalCardListCache = createCardListCache();
