import { defineStore } from "pinia";
import { ref } from "vue";
import type { Card, DeckCard, DeckCodeError } from "../types";
import {
  encodeDeckCode,
  decodeDeckCode,
  decodeKcgDeckCode,
  encodeKcgDeckCode,
  logger,
} from "../utils";
import { GAME_CONSTANTS } from "../constants";
import { useDeckStore } from "./deck";

import { fromAsyncThrowable } from "neverthrow";
import { sortDeckCards } from "../domain/sort";

export const useDeckCodeStore = defineStore("deckCode", () => {
  const slashDeckCode = ref<string>(""); // スラッシュ区切りコード
  const kcgDeckCode = ref<string>(""); // KCG形式コード
  const importDeckCode = ref<string>("");
  const isGeneratingCode = ref<boolean>(false);
  const showDeckCodeModal = ref<boolean>(false);

  const error = ref<DeckCodeError | null>(null);
  const deckStore = useDeckStore();

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
        logger.debug("デッキが空のため、空のデッキコードを生成しました。");
      } else {
        // デッキカードをソートしてからエンコード
        const sortedDeck = sortDeckCards(deckStore.deckCards);
        const cardIds = sortedDeck.flatMap((item: DeckCard) =>
          Array(item.count).fill(item.card.id),
        );

        slashDeckCode.value = encodeDeckCode(sortedDeck);
        const kcgEncodeResult = encodeKcgDeckCode(cardIds);
        if (kcgEncodeResult.isOk()) {
          kcgDeckCode.value = kcgEncodeResult.value;
        } else {
          const errorMessage = "KCG形式デッキコードの生成に失敗しました";
          logger.error(errorMessage + ":", kcgEncodeResult.error);
          error.value = { type: "generation", message: errorMessage };
          isGeneratingCode.value = false;
          return;
        }

        logger.debug(
          "生成されたスラッシュ区切りデッキコード:",
          slashDeckCode.value,
        );
        logger.debug("生成されたKCG形式デッキコード:", kcgDeckCode.value);
        logger.debug("デッキカード数:", sortedDeck.length);
        logger.debug(
          "デッキ内容:",
          sortedDeck.map((item: DeckCard) => `${item.card.id} x${item.count}`),
        );
      }
    } catch (e) {
      const errorMessage = "デッキコードの生成に失敗しました";
      logger.error(errorMessage + ":", e);
      error.value = { type: "generation", message: errorMessage };
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

    // Clipboard APIを安全にラップ
    const safeClipboardWrite = fromAsyncThrowable(
      async (text: string) => {
        if (!navigator.clipboard?.writeText) {
          throw new Error("Clipboard API is not supported");
        }
        await navigator.clipboard.writeText(text);
      },
      (error: unknown) => error,
    );

    const result = await safeClipboardWrite(codeToCopy);

    if (result.isOk()) {
      logger.info(
        `${codeType === "slash" ? "スラッシュ区切り" : "KCG形式"}デッキコードをコピーしました`,
      );
    } else {
      const errorMessage = `${codeType === "slash" ? "スラッシュ区切り" : "KCG形式"}デッキコードのコピーに失敗しました`;
      logger.error(errorMessage + ":", result.error);
      error.value = { type: "copy", message: errorMessage };
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
        logger.warn(`カードIDが見つかりません: ${id}`);
      }
    }

    // 見つからないカードIDがある場合はまとめてログに記録
    if (missingCardIds.length > 0) {
      logger.warn(
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
      logger.warn(warningMessage);
      error.value = { type: "validation", message: warningMessage };
      return;
    }

    const trimmedCode = importDeckCode.value.trim();

    // デッキコードの最大長チェック
    const MAX_DECK_CODE_LENGTH = GAME_CONSTANTS.MAX_DECK_CODE_LENGTH;
    if (trimmedCode.length > MAX_DECK_CODE_LENGTH) {
      const warningMessage = `デッキコードが長すぎます（最大${MAX_DECK_CODE_LENGTH}文字）`;
      logger.warn(warningMessage);
      error.value = { type: "validation", message: warningMessage };
      return;
    }

    // デッキコード形式を判定
    const format = detectDeckCodeFormat(trimmedCode);
    logger.debug("検出されたデッキコード形式:", format);

    try {
      if (format === "kcg") {
        // KCG形式の処理
        logger.debug("KCG形式のデッキコードをデコード中:", trimmedCode);

        const kcgDecodeResult = decodeKcgDeckCode(trimmedCode);

        if (kcgDecodeResult.isOk()) {
          const cardIds = kcgDecodeResult.value;
          logger.debug("KCGデコードで取得されたカードID:", cardIds);

          if (cardIds.length > 0) {
            const result = convertKcgCardIdsToDeckCards(
              cardIds,
              availableCards,
            );

            if (result.deckCards.length > 0) {
              deckStore.setDeckCards(result.deckCards);
              importDeckCode.value = "";
              showDeckCodeModal.value = false;

              // 見つからないカードIDがある場合は警告メッセージも表示
              if (result.missingCardIds.length > 0) {
                const missingCardsMessage = `見つからないカードID: ${result.missingCardIds.join(", ")}`;
                logger.warn(missingCardsMessage);
                error.value = {
                  type: "decode",
                  message: `KCG形式のデッキをインポートしました（${result.deckCards.length}種類のカード）。\n${missingCardsMessage}`,
                };
              } else {
                logger.info(
                  `KCG形式のデッキをインポートしました（${result.deckCards.length}種類のカード）`,
                );
              }
            } else {
              let warningMessage =
                "有効なカードが見つかりませんでした。カードIDが正しいか確認してください。";
              if (result.missingCardIds.length > 0) {
                warningMessage += `\n見つからないカードID: ${result.missingCardIds.join(", ")}`;
              }
              logger.warn(warningMessage);
              error.value = { type: "decode", message: warningMessage };
            }
          } else {
            const warningMessage =
              "デッキコードからカード情報を取得できませんでした。";
            logger.warn(warningMessage);
            error.value = { type: "decode", message: warningMessage };
          }
        } else {
          // KCGデコードエラーの処理
          let errorMessage: string;
          switch (kcgDecodeResult.error.type) {
            case "invalidFormat":
              errorMessage = kcgDecodeResult.error.message;
              break;
            default:
              errorMessage = "KCG形式のデッキコードのデコードに失敗しました";
          }
          logger.warn(errorMessage);
          error.value = { type: "decode", message: errorMessage };
        }
      } else if (format === "slash") {
        // スラッシュ区切り形式の処理（既存の処理）
        logger.debug(
          "スラッシュ区切り形式のデッキコードをデコード中:",
          trimmedCode,
        );

        // スラッシュ区切り形式の基本的な形式チェック
        if (
          trimmedCode.includes("//") ||
          trimmedCode.startsWith("/") ||
          trimmedCode.endsWith("/")
        ) {
          const warningMessage = "無効なデッキコード形式です";
          logger.warn(warningMessage);
          error.value = { type: "validation", message: warningMessage };
          return;
        }

        const decodeResult = decodeDeckCode(trimmedCode, availableCards);

        if (decodeResult.isOk()) {
          const { deckCards: importedCards, missingCardIds } =
            decodeResult.value;
          if (importedCards.length > 0) {
            deckStore.setDeckCards(importedCards);
            importDeckCode.value = "";
            showDeckCodeModal.value = false;

            // 見つからないカードIDがある場合は警告メッセージも表示
            if (missingCardIds.length > 0) {
              const missingCardsMessage = `見つからないカードID: ${missingCardIds.join(", ")}`;
              logger.warn(missingCardsMessage);
              error.value = {
                type: "decode",
                message: `スラッシュ区切り形式のデッキをインポートしました（${importedCards.length}種類のカード）。\n${missingCardsMessage}`,
              };
            } else {
              logger.info(
                `スラッシュ区切り形式のデッキをインポートしました（${importedCards.length}種類のカード）`,
              );
            }
          } else {
            let warningMessage =
              "有効なカードが見つかりませんでした。カードIDが正しいか確認してください。";
            if (missingCardIds.length > 0) {
              warningMessage += `\n見つからないカードID: ${missingCardIds.join(", ")}`;
            }
            logger.warn(warningMessage);
            error.value = { type: "decode", message: warningMessage };
          }
        } else {
          // スラッシュ区切りデコードエラーの処理
          let errorMessage: string;
          switch (decodeResult.error.type) {
            case "emptyCode":
              errorMessage = "デッキコードが空です";
              break;
            case "invalidCardId":
              errorMessage = `無効なカードIDが含まれています: ${decodeResult.error.invalidId}`;
              break;
            default:
              errorMessage = "デッキコードのデコードに失敗しました";
          }
          logger.warn(errorMessage);
          error.value = { type: "decode", message: errorMessage };
        }
      } else {
        // 未知の形式
        const warningMessage =
          "サポートされていないデッキコード形式です。スラッシュ区切り形式またはKCG形式（KCG-で始まる）を使用してください。";
        logger.warn(warningMessage);
        error.value = { type: "validation", message: warningMessage };
      }
    } catch (e) {
      const errorMessage = "デッキコードの復元に失敗しました";
      logger.error(errorMessage + ":", e);
      error.value = { type: "decode", message: errorMessage };
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
