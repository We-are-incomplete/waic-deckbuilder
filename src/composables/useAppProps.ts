import { computed } from "vue";
import type {
  useCardsStore,
  useDeckStore,
  useFilterStore,
  useDeckCodeStore,
  useExportStore,
  useDeckManagementStore,
  useAppStore,
} from "../stores";

/**
 * App.vueの計算プロパティを管理するコンポーザブル
 */
export function useAppProps(
  cardsStore: ReturnType<typeof useCardsStore>,
  deckStore: ReturnType<typeof useDeckStore>,
  filterStore: ReturnType<typeof useFilterStore>,
  deckCodeStore: ReturnType<typeof useDeckCodeStore>,
  exportStore: ReturnType<typeof useExportStore>,
  deckManagementStore: ReturnType<typeof useDeckManagementStore>,
  appStore: ReturnType<typeof useAppStore>,
) {
  // モーダル表示の条件
  const modalVisibility = computed(() => ({
    filter: filterStore.isFilterModalOpen,
    deckCode: deckCodeStore.showDeckCodeModal,
    resetConfirm: appStore.showResetConfirmModal,
    deckManagement: deckManagementStore.isDeckManagementModalOpen,
  }));

  // デッキセクションのプロパティ
  const deckSectionProps = computed(() => ({
    isGeneratingCode: deckCodeStore.isGeneratingCode,
    isSaving: exportStore.isSaving,
  }));

  // カード一覧セクションのプロパティ
  const cardListSectionProps = computed(() => ({
    availableCards: cardsStore.availableCards,
    sortedAndFilteredCards: filterStore.sortedAndFilteredCards,
    deckCards: deckStore.deckCards,
    isLoading: cardsStore.isLoading,
    error: cardsStore.error?.message || null,
  }));

  // デッキコードモーダルのプロパティ
  const deckCodeModalProps = computed(() => ({
    isVisible: deckCodeStore.showDeckCodeModal,
    slashDeckCode: deckCodeStore.slashDeckCode,
    kcgDeckCode: deckCodeStore.kcgDeckCode,
    importDeckCode: deckCodeStore.importDeckCode,
    error: deckCodeStore.error?.message || null,
  }));

  return {
    modalVisibility,
    deckSectionProps,
    cardListSectionProps,
    deckCodeModalProps,
  };
}
