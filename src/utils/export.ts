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
export const downloadCanvas = (canvas: HTMLCanvasElement, filename: string): void => {
  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  link.click();
};
