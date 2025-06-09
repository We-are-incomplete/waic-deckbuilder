import { ref } from "vue";
import {
  useCards,
  useDeck,
  useExport,
  useFilter,
  useDeckCode,
  useDeckReset,
  useToast,
} from ".";
import { handleError } from "../utils";

/**
 * アプリケーション全体の状態を管理するcomposable
 */
export function useApp() {
  // Template refs
  const deckSectionRef = ref<any>(null);

  // Composables
  const { availableCards, isLoading, error, loadCards } = useCards();

  const {
    deckCards,
    deckName,
    sortedDeckCards,
    totalDeckCards,
    addCardToDeck,
    incrementCardCount,
    decrementCardCount,
    initializeDeck,
    setDeckName,
    setDeckCards,
    resetDeckCards,
    resetDeckName,
  } = useDeck();

  const {
    deckCode,
    importDeckCode,
    isGeneratingCode,
    showDeckCodeModal,
    error: deckCodeError,
    generateAndShowDeckCode,
    copyDeckCode,
    importDeckFromCode,
    setImportDeckCode,
  } = useDeckCode(deckCards);

  const {
    showResetConfirmModal,
    resetDeck,
    confirmResetDeck,
    cancelResetDeck,
  } = useDeckReset(resetDeckCards, resetDeckName);

  const { toasts, showError, showSuccess, removeToast } = useToast();

  const {
    isFilterModalOpen,
    filterCriteria,
    allTags,
    sortedAndFilteredCards,
    openFilterModal,
    closeFilterModal,
    updateFilterCriteria,
    allKinds,
    allTypes,
  } = useFilter(availableCards);

  const { isSaving, saveDeckAsPng: exportSaveDeckAsPng } = useExport();

  // Methods
  const saveDeckAsPng = async (): Promise<void> => {
    const exportContainer = deckSectionRef.value?.exportContainer;
    if (exportContainer) {
      try {
        await exportSaveDeckAsPng(deckName.value, exportContainer);
        showSuccess("デッキ画像を保存しました！");
      } catch (error) {
        handleError(
          "デッキ画像の保存中にエラーが発生しました",
          error,
          showError
        );
      }
    }
  };

  const initializeApp = async (): Promise<void> => {
    try {
      await loadCards();
      initializeDeck(availableCards.value);
    } catch (error) {
      handleError("カードの読み込み中にエラーが発生しました", error, showError);
    }
  };

  return {
    // Template refs
    deckSectionRef,

    // Cards state
    availableCards,
    isLoading,
    error,

    // Deck state
    deckCards,
    deckName,
    sortedDeckCards,
    totalDeckCards,

    // Deck actions
    addCardToDeck,
    incrementCardCount,
    decrementCardCount,
    setDeckName,

    // Deck code state
    deckCode,
    importDeckCode,
    isGeneratingCode,
    showDeckCodeModal,
    deckCodeError,

    // Deck code actions
    generateAndShowDeckCode,
    copyDeckCode,
    importDeckFromCode: () =>
      importDeckFromCode(availableCards.value, setDeckCards),
    setImportDeckCode,

    // Reset state
    showResetConfirmModal,

    // Reset actions
    resetDeck,
    confirmResetDeck,
    cancelResetDeck,

    // Toast state
    toasts,

    // Toast actions
    removeToast,

    // Filter state
    isFilterModalOpen,
    filterCriteria,
    allTags,
    sortedAndFilteredCards,
    allKinds,
    allTypes,

    // Filter actions
    openFilterModal,
    closeFilterModal,
    updateFilterCriteria,

    // Export state
    isSaving,

    // Export actions
    saveDeckAsPng,

    // App lifecycle
    initializeApp,
  };
}
