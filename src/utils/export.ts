// カード幅計算に使用する定数
const CARD_COUNT_THRESHOLD_SMALL = 30;
const CARD_COUNT_THRESHOLD_MEDIUM = 48;
const CARDS_PER_ROW_SMALL = 10;
const CARDS_PER_ROW_MEDIUM = 12;
const CARDS_PER_ROW_LARGE = 15;
const MARGIN_SMALL = 36;
const MARGIN_MEDIUM = 44;
const MARGIN_LARGE = 56;

/**
 * カード枚数に基づいてカード幅を計算
 */
export const calculateCardWidth = (cardCount: number): string => {
  if (cardCount <= CARD_COUNT_THRESHOLD_SMALL) {
    return `calc((100% - ${MARGIN_SMALL}px) / ${CARDS_PER_ROW_SMALL})`;
  }
  if (cardCount <= CARD_COUNT_THRESHOLD_MEDIUM) {
    return `calc((100% - ${MARGIN_MEDIUM}px) / ${CARDS_PER_ROW_MEDIUM})`;
  }
  return `calc((100% - ${MARGIN_LARGE}px) / ${CARDS_PER_ROW_LARGE})`;
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
