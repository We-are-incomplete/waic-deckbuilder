/**
 * 仕様:
 * - 目的: デッキコードの生成/判定/インポート(Store)
 * - 入力: deckStore.deckCards / importDeckCode
 * - 出力: slashDeckCode, kcgDeckCode, デッキセット、副作用: クリップボード
 * - 形式: "slash"（decodeDeckCode 内でスキーマ/構文検証）, "kcg"（"KCG-"接頭辞）
 * - エラー方針: DeckCodeError を UI へ伝播（validation/decode/copy/generation）
 */
import { defineStore } from "pinia";
import { ref } from "vue";
import { useClipboard } from "@vueuse/core";
import type { Card, DeckCard } from "../types";
import { DeckCodeError } from "../types";
import {
  encodeDeckCode,
  decodeDeckCode,
  decodeKcgDeckCode,
  encodeKcgDeckCode,
  toDeckCardsFromCardIds,
} from "../utils";
import { sortDeckCards } from "../domain";
import { useDeckStore } from "./deck";

function buildNoValidCardsMessage(missing: readonly string[]): string {
  let msg =
    "有効なカードが見つかりませんでした。カードIDが正しいか確認してください。";
  if (missing.length > 0)
    msg += `\n見つからないカードID: ${missing.join(", ")}`;
  return msg;
}

export const useDeckCodeStore = defineStore("deckCode", () => {
  const slashDeckCode = ref<string>(""); // スラッシュ区切りコード
  const kcgDeckCode = ref<string>(""); // KCG形式コード
  const importDeckCode = ref<string>("");
  const isGeneratingCode = ref<boolean>(false);
  const showDeckCodeModal = ref<boolean>(false);

  const error = ref<DeckCodeError | null>(null);
  const deckStore = useDeckStore();

  const { copy: copyToClipboard, isSupported } = useClipboard();

  /**
   * デッキコードを生成
   */
  const generateDeckCodes = (): void => {
    isGeneratingCode.value = true;
    error.value = null;
    try {
      if (deckStore.deckCards.length === 0) {
        slashDeckCode.value = "";
        kcgDeckCode.value = "";
        console.debug("デッキが空のため、空のデッキコードを生成しました。");
      } else {
        // デッキカードをソートしてからエンコード
        const sortedDeck = sortDeckCards([...deckStore.deckCards]);
        const cardIds = sortedDeck.flatMap((item: DeckCard) =>
          Array(item.count).fill(item.card.id),
        );

        slashDeckCode.value = encodeDeckCode(sortedDeck);
        try {
          kcgDeckCode.value = encodeKcgDeckCode(cardIds);
        } catch (e) {
          const errorMessage = "KCG形式デッキコードの生成に失敗しました";
          console.error(errorMessage + ":", e);
          error.value = new DeckCodeError({
            type: "generation",
            message:
              e instanceof Error
                ? `${errorMessage}: ${e.message}`
                : errorMessage,
            originalError: e,
          });
          return;
        }

        console.debug(
          "生成されたスラッシュ区切りデッキコード:",
          slashDeckCode.value,
        );
        console.debug("生成されたKCG形式デッキコード:", kcgDeckCode.value);
        console.debug("デッキカード数:", sortedDeck.length);
        console.debug(
          "デッキ内容:",
          sortedDeck.map((item: DeckCard) => `${item.card.id} x${item.count}`),
        );
      }
    } catch (e) {
      const errorMessage = "デッキコードの生成に失敗しました";
      console.error(errorMessage + ":", e);
      error.value = new DeckCodeError({
        type: "generation",
        message: errorMessage,
      });
    } finally {
      isGeneratingCode.value = false;
    }
  };

  /**
   * デッキコードを生成し、モーダルを表示
   */
  const generateAndShowDeckCode = (): void => {
    generateDeckCodes();
    showDeckCodeModal.value = true;
  };

  /**
   * デッキコードをクリップボードにコピー
   * @param codeType コピーするコードの種類 ('slash' or 'kcg')
   */
  const copyDeckCode = async (codeType: "slash" | "kcg"): Promise<void> => {
    error.value = null;
    const codeToCopy =
      codeType === "slash" ? slashDeckCode.value : kcgDeckCode.value;

    if (!codeToCopy) {
      const msg = `${codeType === "slash" ? "スラッシュ区切り" : "KCG形式"}デッキコードが空です`;
      console.warn(msg);
      error.value = new DeckCodeError({ type: "copy", message: msg });
      return;
    }

    if (!isSupported.value) {
      const msg =
        "この環境ではクリップボードへのコピーがサポートされていません";
      console.warn(msg);
      error.value = new DeckCodeError({ type: "copy", message: msg });
      return;
    }

    try {
      await copyToClipboard(codeToCopy);
      console.debug(
        `${codeType === "slash" ? "スラッシュ区切り" : "KCG形式"}デッキコードをコピーしました`,
      );
    } catch (e) {
      const errorMessage = `${codeType === "slash" ? "スラッシュ区切り" : "KCG形式"}デッキコードのコピーに失敗しました`;
      console.error(errorMessage + ":", e);
      error.value = new DeckCodeError({ type: "copy", message: errorMessage });
    }
  };

  /**
   * デッキコード形式を判定
   */
  const detectDeckCodeFormat = (code: string): "kcg" | "slash" | "unknown" => {
    const s = code.trim();
    if (s.startsWith("KCG-")) return "kcg";
    if (s.includes("/")) return "slash";
    return "unknown";
  };

  /**
   * KCG形式のデッキコードをDeckCard配列に変換
   */
  // KCGカードIDをデッキカードへ変換（共通ユーティリティに委譲）
  const convertKcgCardIdsToDeckCards = (
    cardIds: readonly string[],
    availableCards: readonly Card[],
  ): { deckCards: DeckCard[]; missingCardIds: string[] } => {
    const result = toDeckCardsFromCardIds(cardIds, availableCards);
    if (result.missingCardIds.length > 0) {
      console.warn(
        `利用可能なカードリストに存在しないカードID: ${result.missingCardIds.join(", ")}`,
      );
    }
    return result;
  };

  /**
   * デッキコードからインポート（統合版）
   */
  const importDeckFromCode = (availableCards: readonly Card[]): void => {
    error.value = null;

    // 入力検証：空文字列チェック
    if (!importDeckCode.value || importDeckCode.value.trim() === "") {
      const warningMessage = "デッキコードが空です";
      console.warn(warningMessage);
      error.value = new DeckCodeError({
        type: "validation",
        message: warningMessage,
      });
      return;
    }

    const trimmedCode = importDeckCode.value.trim();

    // デッキコード形式を判定
    const format = detectDeckCodeFormat(trimmedCode);
    console.debug("検出されたデッキコード形式:", format);

    try {
      if (format === "kcg") {
        // KCG形式の処理
        console.debug("KCG形式のデッキコードをデコード中:", trimmedCode);

        let cardIds: string[];
        try {
          cardIds = decodeKcgDeckCode(trimmedCode);
        } catch (e) {
          // KCGデコードエラーの処理
          const errorMessage =
            e instanceof DeckCodeError && e.message
              ? e.message
              : "KCG形式のデッキコードのデコードに失敗しました";
          console.warn(errorMessage);
          error.value = new DeckCodeError({
            type: "decode",
            message: errorMessage,
            originalError: e,
          });
          return;
        }

        console.debug("KCGデコードで取得されたカードID:", cardIds);

        if (cardIds.length > 0) {
          const result = convertKcgCardIdsToDeckCards(cardIds, availableCards);

          if (result.deckCards.length > 0) {
            deckStore.setDeckCards(result.deckCards);
            importDeckCode.value = "";
            showDeckCodeModal.value = false;

            // 見つからないカードIDがある場合は警告メッセージも表示
            if (result.missingCardIds.length > 0) {
              const missingCardsMessage = `見つからないカードID: ${result.missingCardIds.join(", ")}`;
              console.warn(missingCardsMessage);
              error.value = new DeckCodeError({
                type: "decode",
                message: `KCG形式のデッキをインポートしました（${result.deckCards.length}種類のカード）。\n${missingCardsMessage}`,
              });
            } else {
              console.debug(
                `KCG形式のデッキをインポートしました（${result.deckCards.length}種類のカード）`,
              );
            }
          } else {
            const warningMessage = buildNoValidCardsMessage(
              result.missingCardIds,
            );
            console.warn(warningMessage);
            error.value = new DeckCodeError({
              type: "decode",
              message: warningMessage,
            });
          }
        } else {
          const warningMessage =
            "デッキコードからカード情報を取得できませんでした。";
          console.warn(warningMessage);
          error.value = new DeckCodeError({
            type: "decode",
            message: warningMessage,
          });
        }
      } else if (format === "slash") {
        // decodeDeckCode 内でスキーマ検証を行うため、ここでは追加検証しない
        let importedCards: DeckCard[];
        let missingCardIds: string[];
        try {
          const result = decodeDeckCode(trimmedCode, availableCards);
          importedCards = result.deckCards;
          missingCardIds = result.missingCardIds;
        } catch (e) {
          const errorMessage =
            e instanceof DeckCodeError && e.message
              ? e.message
              : "デッキコードのデコードに失敗しました";
          console.warn(errorMessage);
          error.value = new DeckCodeError({
            type: "decode",
            message: errorMessage,
            originalError: e,
          });
          return;
        }

        if (importedCards.length > 0) {
          deckStore.setDeckCards(importedCards);
          importDeckCode.value = "";
          showDeckCodeModal.value = false;

          if (missingCardIds.length > 0) {
            const missingCardsMessage = `見つからないカードID: ${missingCardIds.join(", ")}`;
            console.warn(missingCardsMessage);
            error.value = new DeckCodeError({
              type: "decode",
              message: `スラッシュ区切り形式のデッキをインポートしました（${importedCards.length}種類のカード）。\n${missingCardsMessage}`,
            });
          } else {
            console.debug(
              `スラッシュ区切り形式のデッキをインポートしました（${importedCards.length}種類のカード）`,
            );
          }
        } else {
          const warningMessage = buildNoValidCardsMessage(missingCardIds);
          console.warn(warningMessage);
          error.value = new DeckCodeError({
            type: "decode",
            message: warningMessage,
          });
        }
      } else {
        // 未知の形式
        const warningMessage =
          "サポートされていないデッキコード形式です。スラッシュ区切り形式またはKCG形式（KCG-で始まる）を使用してください。";
        console.warn(warningMessage);
        error.value = new DeckCodeError({
          type: "validation",
          message: warningMessage,
        });
      }
    } catch (e) {
      const errorMessage = "デッキコードの復元に失敗しました";
      console.error(errorMessage + ":", e);
      error.value = new DeckCodeError({
        type: "decode",
        message: errorMessage,
      });
    }
  };

  /**
   * インポート用デッキコードを設定
   */
  const setImportDeckCode = (code: string): void => {
    importDeckCode.value = code;
  };

  return {
    slashDeckCode,
    kcgDeckCode,
    importDeckCode,
    isGeneratingCode,
    showDeckCodeModal,
    error,
    generateDeckCodes,
    generateAndShowDeckCode,
    copyDeckCode,
    importDeckFromCode,
    setImportDeckCode,
  };
});
