import { ok, err, type Result } from "neverthrow";
import type { Card } from "../types/card";
import { logger } from "./logger";

// LRUキャッシュの設定
const MAX_CACHE_SIZE = 200; // 最大キャッシュサイズ
const CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5分間隔でクリーンアップ

// LRUキャッシュエントリー
interface CacheEntry {
  image: HTMLImageElement;
  lastAccessed: number;
}

// キャッシュの状態を管理する型
interface CacheState {
  cache: Map<string, CacheEntry>;
  accessOrder: string[];
  cleanupTimer: ReturnType<typeof setInterval> | null;
}

// グローバルなキャッシュ状態
const cacheState: CacheState = {
  cache: new Map<string, CacheEntry>(),
  accessOrder: [],
  cleanupTimer: null,
};

/**
 * キャッシュにエントリーを設定
 */
const setCacheEntry = (
  key: string,
  image: HTMLImageElement,
): Result<void, string> => {
  if (!key) {
    return err("キーが指定されていません");
  }

  if (!image) {
    return err("画像が指定されていません");
  }

  // 既存のエントリーがあれば削除
  if (cacheState.cache.has(key)) {
    const index = cacheState.accessOrder.indexOf(key);
    if (index > -1) {
      cacheState.accessOrder.splice(index, 1);
    }
  }

  // 新しいエントリーを追加
  cacheState.cache.set(key, {
    image,
    lastAccessed: Date.now(),
  });
  cacheState.accessOrder.push(key);

  // サイズ制限をチェックし、必要に応じて古いエントリーを削除
  evictIfNecessary();

  return ok(undefined);
};

/**
 * キャッシュにキーが存在するかチェック
 */
const hasCacheEntry = (key: string): boolean => {
  if (!key) {
    return false;
  }
  return cacheState.cache.has(key);
};

/**
 * 必要に応じて古いエントリーを削除
 */
const evictIfNecessary = (): void => {
  while (cacheState.cache.size > MAX_CACHE_SIZE) {
    const oldestKey = cacheState.accessOrder.shift();
    if (!oldestKey) {
      break;
    }
    cacheState.cache.delete(oldestKey);
  }
};

/**
 * 古いエントリーをクリーンアップ
 */
const cleanupStaleEntries = (): void => {
  const now = Date.now();
  const staleThreshold = 30 * 60 * 1000; // 30分間未使用のエントリーを削除

  const keysToDelete: string[] = [];

  for (const [key, entry] of cacheState.cache.entries()) {
    if (now - entry.lastAccessed > staleThreshold) {
      keysToDelete.push(key);
    }
  }

  for (const key of keysToDelete) {
    cacheState.cache.delete(key);
    const index = cacheState.accessOrder.indexOf(key);
    if (index > -1) {
      cacheState.accessOrder.splice(index, 1);
    }
  }

  logger.info(
    `Image cache cleanup: removed ${keysToDelete.length} stale entries`,
  );
};

/**
 * 定期的なクリーンアップを開始
 */
const startPeriodicCleanup = (): void => {
  if (cacheState.cleanupTimer) {
    return; // 既に開始済み
  }

  cacheState.cleanupTimer = setInterval(() => {
    cleanupStaleEntries();
  }, CACHE_CLEANUP_INTERVAL);
};

/**
 * キャッシュをクリア
 */
const clearCache = (): void => {
  cacheState.cache.clear();
  cacheState.accessOrder = [];
};

/**
 * キャッシュの統計情報を取得
 */
const getCacheStats = (): { size: number; maxSize: number } => {
  return {
    size: cacheState.cache.size,
    maxSize: MAX_CACHE_SIZE,
  };
};

/**
 * クリーンアップタイマーを停止
 */
const destroyCache = (): void => {
  if (cacheState.cleanupTimer) {
    clearInterval(cacheState.cleanupTimer);
    cacheState.cleanupTimer = null;
  }
  clearCache();
};

// 初期化
startPeriodicCleanup();

/**
 * カード画像URLを取得
 */
export const getCardImageUrl = (cardId: string): Result<string, string> => {
  if (!cardId) {
    return err("カードIDが指定されていません");
  }

  return ok(`${import.meta.env.BASE_URL}cards/${cardId}.avif`);
};

/**
 * カード画像URLを安全に取得
 */
export const getCardImageUrlSafe = (cardId: string): string => {
  const result = getCardImageUrl(cardId);
  if (result.isOk()) {
    return result.value;
  }
  // エラーをログに記録
  logger.warn(`Failed to get image URL for card: ${cardId}`, result.error);
  return `${import.meta.env.BASE_URL}placeholder.avif`; // エラー時はプレースホルダー画像を返す
};

/**
 * 画像エラー時の処理
 */
export const handleImageError = (event: Event): Result<void, string> => {
  if (!event || !event.target) {
    return err("イベントまたはターゲットが指定されていません");
  }

  const target = event.target as HTMLImageElement;
  if (!target) {
    return err("イベントターゲットが画像要素ではありません");
  }

  target.src = `${import.meta.env.BASE_URL}placeholder.avif`;
  target.onerror = null;

  return ok(undefined);
};

/**
 * 画像のプリロード処理
 */
export const preloadImages = (cards: readonly Card[]): Result<void, string> => {
  if (!cards || cards.length === 0) {
    return ok(undefined); // 空配列は正常
  }

  let currentIndex = 0;

  const processBatch = (deadline?: IdleDeadline): void => {
    while (
      currentIndex < cards.length &&
      (!deadline || deadline.timeRemaining() > 0)
    ) {
      const card = cards[currentIndex];

      if (!hasCacheEntry(card.id)) {
        const img = new Image();
        const urlResult = getCardImageUrl(card.id);
        if (urlResult.isOk()) {
          img.src = urlResult.value;
          setCacheEntry(card.id, img);
        }
      }
      currentIndex++;
    }

    if (currentIndex < cards.length) {
      if (typeof requestIdleCallback === "function") {
        requestIdleCallback(processBatch);
      } else {
        // requestIdleCallbackがサポートされていない場合のフォールバック
        setTimeout(() => processBatch(), 100);
      }
    }
  };

  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(processBatch);
  } else {
    // requestIdleCallbackがサポートされていない場合の初期呼び出し
    setTimeout(() => processBatch(), 100);
  }

  return ok(undefined);
};

// キャッシュ管理用のユーティリティ関数をエクスポート
export const clearImageCache = (): void => {
  clearCache();
};

export const getImageCacheStats = (): { size: number; maxSize: number } => {
  return getCacheStats();
};

// アプリケーション終了時のクリーンアップ（必要に応じて呼び出し）
export const destroyImageCache = (): void => {
  destroyCache();
};
