import type { DeckCard } from "../types";

/**
 * カード枚数に基づいてカード幅を計算
 */
export const calculateCardWidth = (cardCount: number): string => {
  if (cardCount <= 30) return "calc((100% - 36px) / 10)";
  if (cardCount <= 48) return "calc((100% - 44px) / 12)";
  return "calc((100% - 56px) / 15)";
};

/**
 * ファイル名を生成
 */
export const generateFileName = (deckName: string): string => {
  const timestamp = new Date()
    .toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })
    .replace(/\//g, "-");
  return `${deckName || "デッキ"}_${timestamp}.png`;
};

/**
 * キャンバスをダウンロード
 */
export const downloadCanvas = (
  canvas: HTMLCanvasElement,
  filename: string
): void => {
  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  link.click();
};

/**
 * エラーハンドリング関数
 */
export const handleError = (error: unknown, message: string): void => {
  console.error(message, error);
};
