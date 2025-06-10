import { defineStore } from "pinia";
import { ref } from "vue";
import { useCardsStore } from "./cards";
import { useDeckStore } from "./deck";
import { useFilterStore } from "./filter";
import { useToastStore } from "./toast";
import { useDeckCodeStore } from "./deckCode";
import { useExportStore } from "./export";
import { handleError } from "../utils";

export const useAppStore = defineStore("app", () => {
  // Template refs
  const deckSectionRef = ref<HTMLElement | null>(null);
  const exportContainerRef = ref<HTMLElement | null>(null);
  const showResetConfirmModal = ref<boolean>(false);

  // 各ストアのインスタンス取得
  const cardsStore = useCardsStore();
  const deckStore = useDeckStore();
  const filterStore = useFilterStore();
  const toastStore = useToastStore();
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
    if (deckSectionRef.value && "cleanupAllHandlers" in deckSectionRef.value) {
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
   * PNG保存処理
   */
  const saveDeckAsPng = async (): Promise<void> => {
    const exportContainer = exportContainerRef.value;
    if (exportContainer) {
      try {
        await exportStore.saveDeckAsPng(deckStore.deckName, exportContainer);
        toastStore.showSuccess("デッキ画像を保存しました！");
      } catch (error) {
        handleError(
          "デッキ画像の保存中にエラーが発生しました",
          error,
          toastStore.showError
        );
      }
    }
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
    exportContainerRef,

    // Reset state
    showResetConfirmModal,

    // Reset actions
    resetDeck,
    confirmResetDeck,
    cancelResetDeck,

    // Export actions
    saveDeckAsPng,

    // Deck code actions
    importDeckFromCode,

    // App lifecycle
    initializeApp,

    // Store instances for direct access
    cardsStore,
    deckStore,
    filterStore,
    toastStore,
    deckCodeStore,
    exportStore,
  };
});
