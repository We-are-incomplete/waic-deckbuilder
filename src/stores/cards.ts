import { defineStore } from "pinia";
import { ref, shallowRef, readonly } from "vue";
import { ok, err, type Result } from "neverthrow";
import type { Card } from "../types";
import { preloadImages, logger } from "../utils";

export const useCardsStore = defineStore("cards", () => {
  const availableCards = shallowRef<readonly Card[]>([]);
  const isLoading = ref<boolean>(true);
  const error = ref<string | null>(null);

  /**
   * カードデータを読み込む
   */
  const loadCards = async (): Promise<Result<void, string>> => {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await fetch(`${import.meta.env.BASE_URL}cards.json`);

      if (!response.ok) {
        const errorMessage = `HTTP error! status: ${response.status}`;
        logger.error("カードデータの読み込みに失敗しました:", errorMessage);
        error.value =
          "カードデータの読み込みに失敗しました。ページを再読み込みしてください。";
        return err(errorMessage);
      }

      const data: Card[] = await response.json();

      if (!Array.isArray(data)) {
        const errorMessage = "カードデータの形式が不正です";
        logger.error(errorMessage);
        error.value =
          "カードデータの形式が不正です。ページを再読み込みしてください。";
        return err(errorMessage);
      }

      availableCards.value = readonly(data);

      const preloadResult = preloadImages(data);
      if (preloadResult.isErr()) {
        logger.warn("画像のプリロードに失敗しました:", preloadResult.error);
        // プリロードの失敗は致命的ではないので続行
      }

      return ok(undefined);
    } catch (e) {
      const errorMessage = "カードデータの読み込みに失敗しました";
      logger.error(errorMessage + ":", e);
      error.value = errorMessage + "。ページを再読み込みしてください。";
      return err(errorMessage);
    } finally {
      isLoading.value = false;
    }
  };

  return {
    availableCards,
    isLoading,
    error,
    loadCards,
  };
});
