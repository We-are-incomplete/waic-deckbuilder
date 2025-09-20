/**
 * Image utilities (simplified):
 * - BASE_URL 正規化と画像 URL 構築のみ
 */

const getNormalizedBaseUrl = (): string => {
  const base = import.meta.env.BASE_URL || "/";
  return base.endsWith("/") ? base : `${base}/`;
};

/**
 * カード画像URLを取得
 */
export const getCardImageUrl = (cardId: string): string => {
  const safeId = String(cardId || "").trim();
  if (!safeId) {
    return getPlaceholderSrc();
  }
  return `${getNormalizedBaseUrl()}cards/${encodeURIComponent(safeId)}.avif`;
};

const getPlaceholderSrc = (): string =>
  `${getNormalizedBaseUrl()}placeholder.avif`;

/**
 * カード画像URLを安全に取得
 */
export const getCardImageUrlSafe = (cardId: string): string => {
  return getCardImageUrl(cardId);
};

/**
 * 画像エラー時の処理
 */
export const handleImageError = (event: Event): void => {
  const t = (event && (event as any).target) as EventTarget | null;
  if (!t || !(t instanceof HTMLImageElement)) {
    return;
  }
  const img = t as HTMLImageElement;
  img.onerror = null;
  try {
    img.fetchPriority = "low";
    img.decoding = "async";
  } catch {}
  img.src = getPlaceholderSrc();
};

// 以降のプリロードやキャッシュ関連の機能は削除し、シンプルなURL取得とエラーフォールバックのみを提供
