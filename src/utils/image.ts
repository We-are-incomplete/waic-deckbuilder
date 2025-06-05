import type { Card } from "../types";
import { GAME_CONSTANTS } from "../constants";

export const cardCache = new Map<string, HTMLImageElement>();

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
