import { getCardImageUrl } from "./image";
import { logger } from "./logger";
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
  return ""; // エラー時は空文字を返す
};
