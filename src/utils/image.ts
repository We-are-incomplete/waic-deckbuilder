/**
 * Image utilities:
 * - LRU キャッシュ（MAX_CACHE_SIZE、TTL 30min）
 * - BASE_URL 正規化と画像 URL 構築
 * - 事前プリロード（requestIdleCallback フォールバック）
 * 注意: DOM を扱う関数（プリロード/クリーンアップ）は SSR では呼び出さない
 */
import type { Card } from "../types";
import { logger } from "./logger";
import { Effect, Data } from "effect";

type NetworkInformationLite = { saveData?: boolean };

export namespace ImageError {
  export class InvalidKey extends Data.TaggedError("InvalidKey")<{
    key?: string;
  }> {}
  export class InvalidImage extends Data.TaggedError("InvalidImage")<{
    reason?: string;
  }> {}
  export class InvalidEvent extends Data.TaggedError("InvalidEvent")<{
    reason?: string;
  }> {}
  export class InvalidTarget extends Data.TaggedError("InvalidTarget")<{
    targetTag?: string;
  }> {}
  export class InvalidCardId extends Data.TaggedError("InvalidCardId")<{
    cardId?: string;
  }> {}
  export type Type =
    | InvalidKey
    | InvalidImage
    | InvalidEvent
    | InvalidTarget
    | InvalidCardId;
}

// LRUキャッシュの設定
const MAX_CACHE_SIZE = 200; // 最大キャッシュサイズ
export const CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5分間隔でクリーンアップ

// 画像プリロードの同時実行上限
const PRELOAD_INFLIGHT_RAW = Number(
  (import.meta.env.VITE_PRELOAD_MAX_INFLIGHT as string | undefined) ?? "",
);
export const PRELOAD_MAX_INFLIGHT =
  Number.isFinite(PRELOAD_INFLIGHT_RAW) && PRELOAD_INFLIGHT_RAW > 0
    ? Math.min(Math.floor(PRELOAD_INFLIGHT_RAW), 16)
    : 6;

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
  generation: number;
}

// グローバルなキャッシュ状態
const cacheState: CacheState = {
  cache: new Map<string, CacheEntry>(),
  accessOrder: [],
  cleanupTimer: null,
  inflight: new Set<string>(),
  generation: 0,
};

// 参照時に LRU を更新
const touchCacheKey = (key: string): void => {
  const entry = cacheState.cache.get(key);
  if (!entry) return;
  entry.lastAccessed = Date.now();
  const idx = cacheState.accessOrder.lastIndexOf(key);
  if (idx !== -1) cacheState.accessOrder.splice(idx, 1);
  cacheState.accessOrder.push(key);
};

// 定期クリーンアップ開始（多重開始防止）
export const startImageCacheMaintenance = (): void => {
  // SSR/非ブラウザでは開始しない
  if (import.meta.env.SSR || typeof window === "undefined") return;
  if (!cacheState.cleanupTimer) {
    // 起動時に1回実行
    cleanupStaleEntries();
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
): Effect.Effect<void, ImageError.Type> => {
  if (!key) {
    return Effect.fail(new ImageError.InvalidKey({ key }));
  }

  if (!(image instanceof HTMLImageElement) || image.naturalWidth <= 0) {
    return Effect.fail(
      new ImageError.InvalidImage({ reason: "empty or not loaded" }),
    );
  }

  return Effect.sync(() => {
    // 既存のエントリーがあれば削除
    if (cacheState.cache.has(key)) {
      const index = cacheState.accessOrder.indexOf(key);
      if (index > -1) {
        cacheState.accessOrder.splice(index, 1);
      }
    }
    // 新しいエントリーを追加
    cacheState.cache.set(key, { image, lastAccessed: Date.now() });
    cacheState.accessOrder.push(key);
    // サイズ制限の適用
    evictIfNecessary();
  });
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
    `Image cache cleanup: removed ${keysToDelete.length} stale entries (size=${cacheState.cache.size}/${MAX_CACHE_SIZE}, ttl=${STALE_ENTRY_TTL_MS}ms)`,
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
  // 進行中ハンドラを無効化
  cacheState.generation++;
  // inflight を明示的にリセット（以降の onload は世代ガードで無効化）
  cacheState.inflight.clear();
  if (cacheState.cleanupTimer) {
    clearInterval(cacheState.cleanupTimer);
    cacheState.cleanupTimer = null;
  }
  clearCache();
};

/**
 * カード画像URLを取得
 */
export const getCardImageUrl = (
  cardId: string,
): Effect.Effect<string, ImageError.Type> => {
  if (!cardId) {
    return Effect.fail(new ImageError.InvalidCardId({ cardId }));
  }

  return Effect.succeed(
    `${getNormalizedBaseUrl()}cards/${encodeURIComponent(cardId)}.avif`,
  );
};

const getPlaceholderSrc = (): string =>
  `${getNormalizedBaseUrl()}placeholder.avif`;

/**
 * カード画像URLを安全に取得
 */
export const getCardImageUrlSafe = (cardId: string): string => {
  const result = Effect.runSync(Effect.either(getCardImageUrl(cardId)));
  if (result._tag === "Right") {
    return result.right;
  }
  // エラーをログに記録
  logger.warn(`Failed to get image URL for card: ${cardId}`, result.left);
  return getPlaceholderSrc();
};

/**
 * 画像エラー時の処理
 */
export const handleImageError = (
  event: Event,
): Effect.Effect<void, ImageError.Type> => {
  if (!event || !event.target) {
    return Effect.fail(new ImageError.InvalidEvent({ reason: "no target" }));
  }

  const t = event.target;
  if (!(t instanceof HTMLImageElement)) {
    return Effect.fail(
      new ImageError.InvalidTarget({ targetTag: (t as any)?.tagName }),
    );
  }
  return Effect.sync(() => {
    const img = t;
    img.onerror = null;
    try {
      // @ts-ignore
      img.fetchPriority = "low";
      img.decoding = "async";
    } catch {}
    img.src = getPlaceholderSrc();
  });
};

/**
 * 画像のプリロード処理
 */
export const preloadImages = (
  cards: readonly Card[],
): Effect.Effect<void, ImageError.Type> => {
  // SSR/非ブラウザ環境では何もしない
  if (import.meta.env.SSR || typeof window === "undefined") {
    return Effect.succeed(undefined);
  }
  // 省データモード/低速回線ではスキップ
  const conn = (navigator as unknown as { connection?: NetworkInformationLite })
    .connection;
  if (conn?.saveData) {
    logger.info("Preload skipped due to saveData mode");
    return Effect.succeed(undefined);
  }
  // 有効なら低優先度で取得
  const setLowFetchPriority = (img: HTMLImageElement): void => {
    try {
      // @ts-ignore
      img.fetchPriority = "low";
    } catch {}
  };
  if (!cards || cards.length === 0) {
    return Effect.succeed(undefined); // 空配列は正常
  }

  return Effect.sync(() => {
    let currentIndex = 0;
    const startGen = cacheState.generation;
    // 事前に重複 ID を除去
    const uniqueCards = Array.from(
      new Map(cards.map((c) => [c.id, c])).values(),
    );
    const processBatch = (deadline?: { timeRemaining: () => number }): void => {
      if (cacheState.generation !== startGen) return;
      while (
        currentIndex < uniqueCards.length &&
        (!deadline || deadline.timeRemaining() > 0)
      ) {
        // 同時実行の上限
        if (cacheState.inflight.size >= PRELOAD_MAX_INFLIGHT) break;
        const card = uniqueCards[currentIndex];
        if (!card.id) {
          currentIndex++;
          continue;
        }
        const url = getCardImageUrlSafe(card.id);
        if (url.endsWith("placeholder.avif")) {
          currentIndex++;
          continue;
        }
        if (!hasCacheEntry(card.id) && !cacheState.inflight.has(card.id)) {
          const gen = cacheState.generation;
          cacheState.inflight.add(card.id);
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.decoding = "async";
          setLowFetchPriority(img);
          img.onload = () => {
            if (gen === cacheState.generation) {
              // 失敗時はログのみ（キー/画像は静的に正当）
              const cacheResult = Effect.runSync(
                Effect.either(setCacheEntry(card.id, img)),
              );
              if (cacheResult._tag === "Left") {
                logger.warn(
                  `Failed to cache preloaded image for card: ${card.id}`,
                  cacheResult.left,
                );
              }
            }
            cacheState.inflight.delete(card.id);
            img.onload = null;
            img.onerror = null;
            // 次バッチを即時スケジュール
            if (currentIndex < uniqueCards.length) {
              if (
                typeof window !== "undefined" &&
                typeof (window as any).requestIdleCallback === "function"
              ) {
                (window as any).requestIdleCallback(processBatch);
              } else {
                setTimeout(() => processBatch(), 0);
              }
            }
          };
          img.onerror = () => {
            if (gen === cacheState.generation) {
              logger.warn(`Preload failed for card: ${card.id}`);
            }
            cacheState.inflight.delete(card.id);
            img.onload = null;
            img.onerror = null;
            // 失敗時も次バッチを即時スケジュール
            if (currentIndex < uniqueCards.length) {
              if (
                typeof window !== "undefined" &&
                typeof (window as any).requestIdleCallback === "function"
              ) {
                (window as any).requestIdleCallback(processBatch);
              } else {
                setTimeout(() => processBatch(), 0);
              }
            }
          };
          img.src = url;
        }
        currentIndex++;
      }

      if (currentIndex < uniqueCards.length) {
        if (
          typeof window !== "undefined" &&
          typeof (window as any).requestIdleCallback === "function"
        ) {
          (window as any).requestIdleCallback(processBatch);
        } else {
          // requestIdleCallbackがサポートされていない場合のフォールバック
          setTimeout(() => processBatch(), 100);
        }
      }
    };

    if (
      typeof window !== "undefined" &&
      typeof (window as any).requestIdleCallback === "function"
    ) {
      (window as any).requestIdleCallback(processBatch);
    } else {
      setTimeout(() => processBatch(), 100);
    }
  });
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
