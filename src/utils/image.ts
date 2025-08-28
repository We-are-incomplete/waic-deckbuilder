/**
 * Image utilities:
 * - LRU キャッシュ（MAX_CACHE_SIZE、TTL 30min）
 * - BASE_URL 正規化と画像 URL 構築
 * - 事前プリロード（requestIdleCallback フォールバック）
 * 注意: ブラウザ専用（SSR では呼び出さない）
 */
import { ok, err, type Result } from "neverthrow";
import type { Card } from "../types";
import { logger } from "./logger";

// LRUキャッシュの設定
const MAX_CACHE_SIZE = 200; // 最大キャッシュサイズ
export const CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5分間隔でクリーンアップ

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
  inflight: Set<string>;
}

// グローバルなキャッシュ状態
const cacheState: CacheState = {
  cache: new Map<string, CacheEntry>(),
  accessOrder: [],
  cleanupTimer: null,
  inflight: new Set<string>(),
};

// 参照時に LRU を更新
const touchCacheKey = (key: string): void => {
  const entry = cacheState.cache.get(key);
  if (!entry) return;
  entry.lastAccessed = Date.now();
  const idx = cacheState.accessOrder.indexOf(key);
  if (idx > -1) cacheState.accessOrder.splice(idx, 1);
  cacheState.accessOrder.push(key);
};

// 定期クリーンアップ開始（多重開始防止）
export const startImageCacheMaintenance = (): void => {
  // SSR では開始しない
  if (import.meta.env.SSR) return;
  if (!cacheState.cleanupTimer) {
    cacheState.cleanupTimer = setInterval(
      cleanupStaleEntries,
      CACHE_CLEANUP_INTERVAL,
    );
  }
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

export const getCachedImage = (key: string): HTMLImageElement | undefined => {
  const entry = cacheState.cache.get(key);
  if (!entry) return undefined;
  touchCacheKey(key);
  return entry.image;
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

const getNormalizedBaseUrl = (): string => {
  const base = import.meta.env.BASE_URL || "/";
  return base.endsWith("/") ? base : `${base}/`;
};

/**
 * 古いエントリーをクリーンアップ
 */
const DEFAULT_STALE_ENTRY_TTL_MS = 30 * 60 * 1000; // 30min
const TTL_FROM_ENV_RAW = Number(
  (import.meta.env.VITE_IMAGE_CACHE_TTL_MS as string | undefined) ?? "",
);
// 有効なのは「正の有限整数」に限定（0/負数/NaN/Infinityは無効）
const TTL_FROM_ENV =
  Number.isFinite(TTL_FROM_ENV_RAW) && TTL_FROM_ENV_RAW > 0
    ? Math.floor(TTL_FROM_ENV_RAW)
    : NaN;
export const STALE_ENTRY_TTL_MS = Number.isFinite(TTL_FROM_ENV)
  ? TTL_FROM_ENV
  : DEFAULT_STALE_ENTRY_TTL_MS;
export const cleanupStaleEntries = (): void => {
  const now = Date.now();
  const staleThreshold = STALE_ENTRY_TTL_MS;

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

  logger.debug(
    `Image cache cleanup: removed ${keysToDelete.length} stale entries`,
  );
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

/**
 * カード画像URLを取得
 */
export const getCardImageUrl = (cardId: string): Result<string, string> => {
  if (!cardId) {
    return err("カードIDが指定されていません");
  }

  return ok(
    `${getNormalizedBaseUrl()}cards/${encodeURIComponent(cardId)}.avif`,
  );
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
  return `${getNormalizedBaseUrl()}placeholder.avif`;
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

  target.src = `${getNormalizedBaseUrl()}placeholder.avif`;
  target.onerror = null;

  return ok(undefined);
};

/**
 * 画像のプリロード処理
 */
export const preloadImages = (cards: readonly Card[]): Result<void, string> => {
  // SSR/非ブラウザ環境では何もしない
  if (import.meta.env.SSR || typeof window === "undefined") {
    return ok(undefined);
  }
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

      if (!hasCacheEntry(card.id) && !cacheState.inflight.has(card.id)) {
        const urlResult = getCardImageUrl(card.id);
        if (urlResult.isOk()) {
          cacheState.inflight.add(card.id);
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            setCacheEntry(card.id, img);
            cacheState.inflight.delete(card.id);
            img.onload = null;
            img.onerror = null;
          };
          img.onerror = () => {
            logger.warn(`Preload failed for card: ${card.id}`);
            cacheState.inflight.delete(card.id);
            img.onload = null;
            img.onerror = null;
          };
          img.src = urlResult.value;
        } else {
          logger.warn(
            `Preload skipped: invalid URL for card: ${card.id}`,
            urlResult.error
          );
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
