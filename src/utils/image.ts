/**
 * Image utilities:
 * - LRU キャッシュ（MAX_CACHE_SIZE、TTL 30min）
 * - BASE_URL 正規化と画像 URL 構築
 * - 事前プリロード（requestIdleCallback フォールバック）
 * 注意: DOM を扱う関数（プリロード/クリーンアップ）は SSR では呼び出さない
 */
import type { Card } from "../types";
type NetworkInformationLite = { saveData?: boolean };

export namespace ImageError {
  export class InvalidKey extends Error {
    readonly key?: string;
    constructor(params?: { key?: string }) {
      super(params?.key ? `InvalidKey: ${params.key}` : "InvalidKey");
      this.name = "InvalidKey";
      this.key = params?.key;
      Object.setPrototypeOf(this, InvalidKey.prototype);
    }
  }
  export class InvalidImage extends Error {
    readonly reason?: string;
    constructor(params?: { reason?: string }) {
      super(params?.reason ? `InvalidImage: ${params.reason}` : "InvalidImage");
      this.name = "InvalidImage";
      this.reason = params?.reason;
      Object.setPrototypeOf(this, InvalidImage.prototype);
    }
  }
  export class InvalidEvent extends Error {
    readonly reason?: string;
    constructor(params?: { reason?: string }) {
      super(params?.reason ? `InvalidEvent: ${params.reason}` : "InvalidEvent");
      this.name = "InvalidEvent";
      this.reason = params?.reason;
      Object.setPrototypeOf(this, InvalidEvent.prototype);
    }
  }
  export class InvalidTarget extends Error {
    readonly targetTag?: string;
    constructor(params?: { targetTag?: string }) {
      super(
        params?.targetTag
          ? `InvalidTarget: ${params.targetTag}`
          : "InvalidTarget",
      );
      this.name = "InvalidTarget";
      this.targetTag = params?.targetTag;
      Object.setPrototypeOf(this, InvalidTarget.prototype);
    }
  }
  export class InvalidCardId extends Error {
    readonly cardId?: string;
    constructor(params?: { cardId?: string }) {
      super(
        params?.cardId ? `InvalidCardId: ${params.cardId}` : "InvalidCardId",
      );
      this.name = "InvalidCardId";
      this.cardId = params?.cardId;
      Object.setPrototypeOf(this, InvalidCardId.prototype);
    }
  }
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
const setCacheEntry = (key: string, image: HTMLImageElement): void => {
  if (!key) {
    throw new ImageError.InvalidKey({ key });
  }

  if (!(image instanceof HTMLImageElement) || image.naturalWidth <= 0) {
    throw new ImageError.InvalidImage({ reason: "empty or not loaded" });
  }

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

  if (import.meta.env?.DEV) {
    console.debug(
      `Image cache cleanup: removed ${keysToDelete.length} stale entries (size=${cacheState.cache.size}/${MAX_CACHE_SIZE}, ttl=${STALE_ENTRY_TTL_MS}ms)`,
    );
  }
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
const getCacheStats = (): {
  size: number;
  maxSize: number;
  inflight: number;
} => {
  return {
    size: cacheState.cache.size,
    maxSize: MAX_CACHE_SIZE,
    inflight: cacheState.inflight.size,
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
export const getCardImageUrl = (cardId: string): string => {
  if (!cardId) {
    throw new ImageError.InvalidCardId({ cardId });
  }

  return `${getNormalizedBaseUrl()}cards/${encodeURIComponent(cardId)}.avif`;
};

const getPlaceholderSrc = (): string =>
  `${getNormalizedBaseUrl()}placeholder.avif`;

/**
 * カード画像URLを安全に取得
 */
export const getCardImageUrlSafe = (cardId: string): string => {
  try {
    return getCardImageUrl(cardId);
  } catch (error) {
    // エラーをログに記録
    console.warn(`Failed to get image URL for card: ${cardId}`, error);
    return getPlaceholderSrc();
  }
};

/**
 * 画像エラー時の処理
 */
export const handleImageError = (event: Event): void => {
  const t = (event && (event as any).target) as EventTarget | null;
  if (!t || !(t instanceof HTMLImageElement)) {
    console.warn("handleImageError: invalid event/target", {
      event,
      target: (t as any)?.tagName,
    });
    return;
  }
  const img = t as HTMLImageElement;
  img.onerror = null;
  try {
    img.fetchPriority = "low";
    img.decoding = "async";
  } catch (e) {
    console.warn("Failed to set image properties", e);
  }
  img.src = getPlaceholderSrc();
};

/**
 * 画像のプリロード処理
 */
// ヘルパー関数: 低優先度フェッチの設定
const setLowFetchPriority = (img: HTMLImageElement): void => {
  try {
    img.fetchPriority = "low";
  } catch (e) {
    console.warn("Failed to set fetchPriority", e);
  }
};

// ヘルパー関数: プリロードをスキップすべきか判定
const shouldSkipPreload = (): boolean => {
  if (import.meta.env.SSR || typeof window === "undefined") {
    return true;
  }
  const conn = (navigator as unknown as { connection?: NetworkInformationLite })
    .connection;
  if (conn?.saveData) {
    console.debug("Preload skipped due to saveData mode");
    return true;
  }
  return false;
};

// ヘルパー関数: 次のバッチをスケジュール
const scheduleNextBatch = (
  processBatch: (deadline?: { timeRemaining: () => number }) => void,
): void => {
  if (
    typeof window !== "undefined" &&
    typeof (window as any).requestIdleCallback === "function"
  ) {
    (window as any).requestIdleCallback(processBatch);
  } else {
    setTimeout(() => processBatch(), 100);
  }
};

// ヘルパー関数: 単一のカード画像をプリロード
const preloadSingleCardImage = (cardId: string, startGen: number): void => {
  if (cacheState.generation !== startGen) return; // 世代チェック

  let url: string;
  try {
    url = getCardImageUrl(cardId);
  } catch (e) {
    console.warn(`Failed to get image URL for card: ${cardId}`, e);
    return;
  }

  if (!hasCacheEntry(cardId) && !cacheState.inflight.has(cardId)) {
    cacheState.inflight.add(cardId);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    setLowFetchPriority(img);

    img.onload = () => {
      if (startGen === cacheState.generation) {
        // 世代チェック
        try {
          setCacheEntry(cardId, img);
        } catch (e) {
          console.warn(
            `Failed to cache preloaded image for card: ${cardId}`,
            e,
          );
        }
      }
      cacheState.inflight.delete(cardId);
      img.onload = null;
      img.onerror = null;
    };

    img.onerror = () => {
      cacheState.inflight.delete(cardId);
      img.onload = null;
      img.onerror = null;
    };
    img.src = url;
  }
};

export const preloadImages = (cards: readonly Card[]): void => {
  if (shouldSkipPreload()) {
    return;
  }

  if (!cards || cards.length === 0) {
    return;
  }

  let currentIndex = 0;
  const startGen = cacheState.generation;
  const uniqueCards = Array.from(new Map(cards.map((c) => [c.id, c])).values());

  const processBatch = (deadline?: { timeRemaining: () => number }): void => {
    if (cacheState.generation !== startGen) return; // 世代チェック

    while (
      currentIndex < uniqueCards.length &&
      cacheState.inflight.size < PRELOAD_MAX_INFLIGHT &&
      (!deadline || deadline.timeRemaining() > 0)
    ) {
      const card = uniqueCards[currentIndex];
      if (card.id) {
        preloadSingleCardImage(card.id, startGen);
      }
      currentIndex++;
    }

    if (currentIndex < uniqueCards.length) {
      scheduleNextBatch(processBatch);
    }
  };

  scheduleNextBatch(processBatch);
};
// キャッシュ管理用のユーティリティ関数をエクスポート
export const clearImageCache = (): void => {
  clearCache();
};

export const getImageCacheStats = (): {
  size: number;
  maxSize: number;
  inflight: number;
} => {
  const { size, maxSize, inflight } = getCacheStats();
  return { size, maxSize, inflight };
};

// アプリケーション終了時のクリーンアップ（必要に応じて呼び出し）
export const destroyImageCache = (): void => {
  destroyCache();
};
