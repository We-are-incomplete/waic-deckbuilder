import { defineStore } from "pinia";
import { ref, readonly } from "vue";
import { useCardsStore } from "./cards";
import { useDeckStore } from "./deck";
import { useFilterStore } from "./filter";

import { useDeckCodeStore } from "./deckCode";
import { useExportStore } from "./export";
import { useDeckManagementStore } from "./deckManagement";

import type DeckSection from "../components/layout/DeckSection.vue";

// Vue 3.5の新機能: Template refs management
// より柔軟なtemplate ref管理
// DeckSectionコンポーネントのインスタンス型を定義
// Vue 3.5の新機能: InstanceType<typeof Component> でコンポーネントインスタンスの型を正確に取得
export type DeckSectionInstance = InstanceType<typeof DeckSection>;

export const useAppStore = defineStore("app", () => {
  let deckSectionRef = ref<DeckSectionInstance | null>(null);

  // Vue 3.5の新機能: shallowRef for performance optimization
  // 頻繁に変更されない状態にはshallowRefを使用
  const showResetConfirmModal = ref<boolean>(false);

  // 各ストアのインスタンス取得
  const cardsStore = useCardsStore();
  const deckStore = useDeckStore();
  const filterStore = useFilterStore();
  const deckCodeStore = useDeckCodeStore();
  const exportStore = useExportStore();
  const deckManagementStore = useDeckManagementStore();

  /**
   * Vue 3.5最適化: デッキリセット処理
   */
  const resetDeck = (): void => {
    showResetConfirmModal.value = true;
  };

  const confirmResetDeck = (): void => {
    deckStore.resetDeckCards();
    deckStore.resetDeckName();
    showResetConfirmModal.value = false;
  };

  const cancelResetDeck = (): void => {
    showResetConfirmModal.value = false;
  };

  /**
   * Vue 3.5最適化: デッキコードからインポート（カードストアとの連携）
   */
  const importDeckFromCode = (): void => {
    deckCodeStore.importDeckFromCode(cardsStore.availableCards);
  };

  /**
   * Vue 3.5最適化: アプリケーション初期化
   * より効率的な非同期処理パターン
   */
  const initializeApp = async (): Promise<void> => {
    await cardsStore.loadCards();
    // カードの読み込みに失敗した場合は後続の処理をスキップ
    if (cardsStore.error) {
      return;
    }
    deckStore.initializeDeck(cardsStore.availableCards);
    deckCodeStore.generateDeckCodes();
  };

  return {
    // Template refs - Vue 3.5 compatible
    get deckSectionRef() {
      return deckSectionRef.value;
    },
    set deckSectionRef(value: DeckSectionInstance | null) {
      deckSectionRef.value = value;
    },

    // Reset state
    showResetConfirmModal: readonly(showResetConfirmModal),

    // Reset actions
    resetDeck,
    confirmResetDeck,
    cancelResetDeck,

    // Deck code actions
    importDeckFromCode,

    // App lifecycle
    initializeApp,

    // Store instances for direct access (Vue 3.5 optimized)
    cardsStore,
    deckStore,
    filterStore,
    deckCodeStore,
    exportStore,
    deckManagementStore,
  };
});
