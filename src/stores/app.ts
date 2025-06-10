import { defineStore } from "pinia";
import { ref } from "vue";
import { useCardsStore } from "./cards";
import { useDeckStore } from "./deck";
import { useFilterStore } from "./filter";

import { useDeckCodeStore } from "./deckCode";
import { useExportStore } from "./export";

export const useAppStore = defineStore("app", () => {
  // Template refs
  const deckSectionRef = ref<HTMLElement | null>(null);
  const showResetConfirmModal = ref<boolean>(false);

  // 各ストアのインスタンス取得
  const cardsStore = useCardsStore();
  const deckStore = useDeckStore();
  const filterStore = useFilterStore();
  const deckCodeStore = useDeckCodeStore();
  const exportStore = useExportStore();

  /**
   * デッキリセット処理
   */
  const resetDeck = (): void => {
    showResetConfirmModal.value = true;
  };

  const confirmResetDeck = (): void => {
    // 長押しハンドラーをクリーンアップ
    if (
      deckSectionRef.value &&
      typeof (deckSectionRef.value as any).cleanupAllHandlers === "function"
    ) {
      (deckSectionRef.value as any).cleanupAllHandlers();
    }

    deckStore.resetDeckCards();
    deckStore.resetDeckName();
    showResetConfirmModal.value = false;
  };

  const cancelResetDeck = (): void => {
    showResetConfirmModal.value = false;
  };

  /**
   * デッキコードからインポート（カードストアとの連携）
   */
  const importDeckFromCode = (): void => {
    deckCodeStore.importDeckFromCode(cardsStore.availableCards);
  };

  /**
   * アプリケーション初期化
   */
  const initializeApp = async (): Promise<void> => {
    await cardsStore.loadCards();
    deckStore.initializeDeck(cardsStore.availableCards);
  };

  return {
    // Template refs
    deckSectionRef,

    // Reset state
    showResetConfirmModal,

    // Reset actions
    resetDeck,
    confirmResetDeck,
    cancelResetDeck,

    // Deck code actions
    importDeckFromCode,

    // App lifecycle
    initializeApp,

    // Store instances for direct access
    cardsStore,
    deckStore,
    filterStore,
    deckCodeStore,
    exportStore,
  };
});
