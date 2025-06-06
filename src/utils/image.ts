import type { Card } from "../types/card";
import { GAME_CONSTANTS } from "../constants/game";

// LRUキャッシュの設定
const MAX_CACHE_SIZE = 200; // 最大キャッシュサイズ
const CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5分間隔でクリーンアップ

// LRUキャッシュエントリー
interface CacheEntry {
  image: HTMLImageElement;
  lastAccessed: number;
}

class LRUImageCache {
  private cache = new Map<string, CacheEntry>();
  private accessOrder: string[] = [];
  private cleanupTimer: number | null = null;

  constructor() {
    // 定期的なクリーンアップの開始
    this.startPeriodicCleanup();
  }

  get(key: string): HTMLImageElement | undefined {
    const entry = this.cache.get(key);
    if (entry) {
      // アクセス時刻を更新
      entry.lastAccessed = Date.now();

      // アクセス順序を更新
      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
      this.accessOrder.push(key);

      return entry.image;
    }
    return undefined;
  }

  set(key: string, image: HTMLImageElement): void {
    // 既存のエントリーがあれば削除
    if (this.cache.has(key)) {
      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
    }

    // 新しいエントリーを追加
    this.cache.set(key, {
      image,
      lastAccessed: Date.now(),
    });
    this.accessOrder.push(key);

    // サイズ制限をチェックし、必要に応じて古いエントリーを削除
    this.evictIfNecessary();
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  private evictIfNecessary(): void {
    while (this.cache.size > MAX_CACHE_SIZE) {
      const oldestKey = this.accessOrder.shift();
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
  }

  private startPeriodicCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupStaleEntries();
    }, CACHE_CLEANUP_INTERVAL);
  }

  private cleanupStaleEntries(): void {
    const now = Date.now();
    const staleThreshold = 30 * 60 * 1000; // 30分間未使用のエントリーを削除

    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.lastAccessed > staleThreshold) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
    }

    console.log(
      `Image cache cleanup: removed ${keysToDelete.length} stale entries`
    );
  }

  // 手動でキャッシュをクリアするメソッド
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  // キャッシュの統計情報を取得
  getStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: MAX_CACHE_SIZE,
    };
  }

  // クリーンアップタイマーを停止（アプリ終了時など）
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clear();
  }
}

// グローバルなLRUキャッシュインスタンス
export const cardCache = new LRUImageCache();

/**
 * カード画像URLを取得
 */
export const getCardImageUrl = (cardId: string): string => {
  return `${import.meta.env.BASE_URL}cards/${cardId}.avif`;
};

/**
 * 画像エラー時の処理
 */
export const handleImageError = (event: Event): void => {
  const target = event.target as HTMLImageElement;
  target.src = `${import.meta.env.BASE_URL}placeholder.avif`;
  target.onerror = null;
};

/**
 * 画像のプリロード処理
 */
export const preloadImages = (cards: readonly Card[]): void => {
  const loadBatch = (startIndex: number): void => {
    const endIndex = Math.min(
      startIndex + GAME_CONSTANTS.BATCH_SIZE_FOR_PRELOAD,
      cards.length
    );
    const batch = cards.slice(startIndex, endIndex);

    for (const card of batch) {
      if (!cardCache.has(card.id)) {
        const img = new Image();
        img.src = getCardImageUrl(card.id);
        cardCache.set(card.id, img);
      }
    }

    if (endIndex < cards.length) {
      setTimeout(() => loadBatch(endIndex), 100);
    }
  };

  loadBatch(0);
};

// キャッシュ管理用のユーティリティ関数をエクスポート
export const clearImageCache = (): void => {
  cardCache.clear();
};

export const getImageCacheStats = (): { size: number; maxSize: number } => {
  return cardCache.getStats();
};

// アプリケーション終了時のクリーンアップ（必要に応じて呼び出し）
export const destroyImageCache = (): void => {
  cardCache.destroy();
};
