import { ref, shallowRef, readonly } from "vue";
import type { Card } from "../types";
import { preloadImages, logger } from "../utils";

export function useCards() {
  const availableCards = shallowRef<readonly Card[]>([]);
  const isLoading = ref<boolean>(true);
  const error = ref<string | null>(null);

  /**
   * カードデータを読み込む
   */
  const loadCards = async (): Promise<void> => {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await fetch(`${import.meta.env.BASE_URL}cards.json`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: Card[] = await response.json();
      availableCards.value = readonly(data);
      preloadImages(data);
    } catch (e) {
      const errorMessage = "カードデータの読み込みに失敗しました";
      logger.error(errorMessage + ":", e);
      error.value = errorMessage + "。ページを再読み込みしてください。";
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
}
