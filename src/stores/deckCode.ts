import { defineStore } from "pinia";
import { ref } from "vue";
import type { Card, DeckCard } from "../types";
import { DeckCodeError } from "../types";
import {
  encodeDeckCode,
  decodeDeckCode,
  decodeKcgDeckCode,
  encodeKcgDeckCode,
} from "../utils";
import { GAME_CONSTANTS } from "../constants";
import { SlashDeckCodeSchema } from "../domain";
import * as v from "valibot";
import { useDeckStore } from "./deck";
import { sortDeckCards } from "../domain";
import { useClipboard } from "@vueuse/core";

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
        const sortedDeck = sortDeckCards(deckStore.deckCards);
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
    const trimmedCode = code.trim();

    // KCG形式の判定
    if (trimmedCode.startsWith("KCG-")) {
      return "kcg";
    }

    // スラッシュ区切り形式の判定
    // カードIDパターンをチェック
    const cardIdPattern = /^([A-Z]|ex|prm)(A|S|M|D)-\d+$/;
    const cardIds = trimmedCode.split("/");
    if (
      cardIds.length > 0 &&
      cardIds.every((id) => cardIdPattern.test(id.trim()))
    ) {
      return "slash";
    }

    return "unknown";
  };

  /**
   * KCG形式のデッキコードをDeckCard配列に変換
   */
  const convertKcgCardIdsToDeckCards = (
    cardIds: readonly string[],
    availableCards: readonly Card[],
  ): { deckCards: DeckCard[]; missingCardIds: string[] } => {
    // availableCardsをMapに変換して高速ルックアップを可能にする
    const availableCardsMap = new Map<string, Card>();
    for (const card of availableCards) {
      availableCardsMap.set(card.id, card);
    }

    const cardCounts = new Map<string, number>();

    // カードIDの枚数をカウント
    for (const id of cardIds) {
      const trimmedId = id.trim();
      if (trimmedId) {
        cardCounts.set(trimmedId, (cardCounts.get(trimmedId) || 0) + 1);
      }
    }

    const deckCards: DeckCard[] = [];
    const missingCardIds: string[] = [];

    for (const [id, count] of cardCounts) {
      const card = availableCardsMap.get(id);
      if (card) {
        deckCards.push({ card, count });
      } else {
        missingCardIds.push(id);
        console.warn(`カードIDが見つかりません: ${id}`);
      }
    }

    // 見つからないカードIDがある場合はまとめてログに記録
    if (missingCardIds.length > 0) {
      console.warn(
        `利用可能なカードリストに存在しないカードID: ${missingCardIds.join(", ")}`,
      );
    }

    return { deckCards, missingCardIds };
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

    // デッキコードの最大長チェック
    const MAX_DECK_CODE_LENGTH = GAME_CONSTANTS.MAX_DECK_CODE_LENGTH;
    if (trimmedCode.length > MAX_DECK_CODE_LENGTH) {
      const warningMessage = `デッキコードが長すぎます（最大${MAX_DECK_CODE_LENGTH}文字）`;
      console.warn(warningMessage);
      error.value = new DeckCodeError({
        type: "validation",
        message: warningMessage,
      });
      return;
    }

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
            let warningMessage =
              "有効なカードが見つかりませんでした。カードIDが正しいか確認してください。";
            if (result.missingCardIds.length > 0) {
              warningMessage += `\n見つからないカードID: ${result.missingCardIds.join(", ")}`;
            }
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
        // スラッシュ区切り形式の処理（既存の処理）
        console.debug(
          "スラッシュ区切り形式のデッキコードをデコード中:",
          trimmedCode,
        );

        // スラッシュ区切り形式の詳細検証（valibot）
        const parsed = v.safeParse(SlashDeckCodeSchema, trimmedCode);
        if (!parsed.success) {
          const warningMessage = parsed.issues[0]?.message || "無効なデッキコード形式です";
          console.warn(warningMessage);
          error.value = new DeckCodeError({
            type: "validation",
            message: warningMessage,
          });
          return;
        }

        let importedCards: DeckCard[];
        let missingCardIds: string[];
        try {
          const result = decodeDeckCode(trimmedCode, availableCards);
          importedCards = result.deckCards;
          missingCardIds = result.missingCardIds;
        } catch (e) {
          // スラッシュ区切りデコードエラーの処理
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

          // 見つからないカードIDがある場合は警告メッセージも表示
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
          let warningMessage =
            "有効なカードが見つかりませんでした。カードIDが正しいか確認してください。";
          if (missingCardIds.length > 0) {
            warningMessage += `\n見つからないカードID: ${missingCardIds.join(", ")}`;
          }
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
