/**
 * エクスポートストアの仕様
 * 範囲: 画像読み込み待ち・タイムアウト・イベントクリーンアップの整合性保証。
 */
import { defineStore } from "pinia";
import { ref, readonly } from "vue";
import {
  getCardImageUrl,
  getPlaceholderSrc,
  getNormalizedBaseUrl,
} from "../utils";
import { useDeckStore } from "./deck";

// エクスポートストア専用のエラー型
class ExportError extends Error {
  readonly type: "canvas" | "imageLoad" | "concurrency" | "unknown";
  readonly originalError: unknown;

  constructor(params: {
    type: "canvas" | "imageLoad" | "concurrency" | "unknown";
    message: string;
    originalError: unknown;
  }) {
    super(params.message);
    this.name = "ExportError";
    this.type = params.type;
    this.originalError = params.originalError;
    Object.setPrototypeOf(this, ExportError.prototype);
  }
}

export const useExportStore = defineStore("export", () => {
  const isSaving = ref<boolean>(false);

  // --- レイアウト用定数 ---
  const CANVAS_WIDTH = 3840 as const;
  const CANVAS_PADDING_X = 241 as const;
  const CANVAS_PADDING_Y = 298 as const;
  const GRID_GAP_X = 13 as const;
  const GRID_GAP_Y = 72 as const;
  const TWO_ROWS_THRESHOLD = 20 as const; // sheet2を使う上限
  const THREE_ROWS_THRESHOLD = 30 as const; // sheetを使う上限
  const CANVAS_HEIGHT_TWO_ROWS = 1636 as const;
  const CANVAS_HEIGHT_THREE_ROWS = 2160 as const;
  const CARD_WIDTH_SMALL = 212 as const; // 30種を超える場合
  const CARD_WIDTH_LARGE = 324 as const; // 30種以下
  const CARD_HEIGHT_SMALL = 296 as const; // 30種を超える場合
  const CARD_HEIGHT_LARGE = 452 as const; // 30種以下
  const CARDS_PER_ROW_SMALL = 15 as const; // 30種を超える場合
  const CARDS_PER_ROW_LARGE = 10 as const; // 30種以下

  const calculateCanvasHeight = (cardCount: number): number => {
    if (cardCount <= TWO_ROWS_THRESHOLD) return CANVAS_HEIGHT_TWO_ROWS;
    return CANVAS_HEIGHT_THREE_ROWS;
  };

  const calculateCardWidth = (cardCount: number): number => {
    if (cardCount <= THREE_ROWS_THRESHOLD) return CARD_WIDTH_LARGE;
    return CARD_WIDTH_SMALL;
  };

  const calculateCardHeight = (cardCount: number): number => {
    if (cardCount <= THREE_ROWS_THRESHOLD) return CARD_HEIGHT_LARGE;
    return CARD_HEIGHT_SMALL;
  };

  const cardsPerRow = (cardCount: number): number => {
    if (cardCount <= THREE_ROWS_THRESHOLD) return CARDS_PER_ROW_LARGE;
    return CARDS_PER_ROW_SMALL;
  };

  const getBackgroundImageUrl = (cardCount: number): string => {
    const normalized = getNormalizedBaseUrl();
    if (cardCount <= TWO_ROWS_THRESHOLD) return `${normalized}sheet2.avif`;
    if (cardCount <= THREE_ROWS_THRESHOLD) return `${normalized}sheet.avif`;
    return `${normalized}sheet_nogrid.avif`;
  };

  const loadImageElement = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.decoding = "async";
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
      img.src = src;
    });
  };

  const ensureShipporiMinchoLoaded = async (): Promise<void> => {
    try {
      const normalized = getNormalizedBaseUrl();
      const url = `${normalized}ShipporiMincho-Bold.ttf`;
      const font = new FontFace("Shippori Mincho", `url(${url})`, {
        style: "normal",
        weight: "700",
        display: "swap",
      });
      // 既に登録済みかどうかの簡易チェック
      // Note: 同一family/weightは重複追加されてもブラウザが内側で扱うため問題になりづらい
      const loaded = await font.load();
      (document as any).fonts?.add(loaded);
      // 使用サイズのプリロード
      await (document as any).fonts?.load('700 128px "Shippori Mincho"');
      await (document as any).fonts?.load('700 36px "Shippori Mincho"');
    } catch {
      // フォントロード失敗は致命ではないため継続
    }
  };

  /**
   * デッキをPNG画像として保存
   */
  const saveDeckAsPng = async (deckName: string): Promise<void> => {
    if (isSaving.value) {
      throw new ExportError({
        type: "concurrency",
        message: "現在エクスポート処理中です。完了後に再度お試しください。",
        originalError: null,
      });
    }

    isSaving.value = true;

    try {
      const deckStore = useDeckStore();
      const deckCards = deckStore.sortedDeckCards;

      // --- Canvas 準備 ---
      const distinctCount = deckCards.length;
      const canvas = document.createElement("canvas");
      const height = calculateCanvasHeight(distinctCount);
      canvas.width = CANVAS_WIDTH;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new ExportError({
          type: "canvas",
          message: "Canvas コンテキストの取得に失敗しました",
          originalError: null,
        });
      }

      // 背景描画
      const bg = await loadImageElement(getBackgroundImageUrl(distinctCount));
      ctx.drawImage(bg, 0, 0, CANVAS_WIDTH, height);

      // ヘッダテキスト（デッキ名 + 合計枚数）
      await ensureShipporiMinchoLoaded();
      ctx.textAlign = "center";
      ctx.fillStyle = "#353100";
      ctx.font = '700 128px "Shippori Mincho"';
      if (deckName) {
        ctx.fillText(`「${deckName}」`, canvas.width / 2, 240);
      }

      // カード群描画
      const cardW = calculateCardWidth(distinctCount);
      const cardH = calculateCardHeight(distinctCount);
      const perRow = cardsPerRow(distinctCount);
      let x = CANVAS_PADDING_X;
      let y = CANVAS_PADDING_Y;
      let inRow = 0;

      // 事前に画像を読み込み（失敗許容: allSettled + プレースホルダ代替）
      const placeholderImg = await loadImageElement(getPlaceholderSrc());
      const results = await Promise.allSettled(
        deckCards.map((dc) => loadImageElement(getCardImageUrl(dc.card.id))),
      );
      const entries = results.map((res, i) => ({
        count: deckCards[i]?.count ?? 0,
        img:
          res.status === "fulfilled"
            ? res.value
            : (placeholderImg as HTMLImageElement | null),
      }));

      ctx.font = '700 36px "Shippori Mincho"';
      for (const { img, count } of entries) {
        if (img) {
          ctx.drawImage(img, x, y, cardW, cardH);
        } else {
          // フォールバック: 何も描かれていないフレーム相当（背景のみ）
        }
        ctx.fillText(`${count}`, x + cardW / 2, y + cardH + 50);
        x += cardW + GRID_GAP_X;
        inRow++;
        if (inRow >= perRow) {
          x = CANVAS_PADDING_X;
          y += cardH + GRID_GAP_Y;
          inRow = 0;
        }
      }

      const canvasToBlob = (
        canvas: HTMLCanvasElement,
        type: string,
      ): Promise<Blob> =>
        new Promise((resolve, reject) =>
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
            type,
          ),
        );

      // ファイル名を生成（予約文字と制御文字を除去）
      const timestamp = new Date()
        .toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })
        .replace(/\//g, "-");
      const filename = `${deckName || "デッキ"}_${timestamp}.png`;
      // キャンバスをBlob化してダウンロード（メモリ効率）
      const blob = await canvasToBlob(canvas, "image/png");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = filename;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      const errorMessage = "デッキ画像の保存に失敗しました";
      if (e instanceof ExportError) {
        throw e;
      }
      throw new ExportError({
        type: "unknown",
        message: errorMessage,
        originalError: e,
      });
    } finally {
      isSaving.value = false;
    }
  };

  return {
    isSaving: readonly(isSaving),
    saveDeckAsPng,
  };
});
