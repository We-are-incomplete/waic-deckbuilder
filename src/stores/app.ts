import { defineStore } from "pinia";
import { ref, readonly } from "vue";
import { useCardsStore } from "./cards";
import { useDeckStore } from "./deck";
import { useFilterStore } from "./filter";

import { useDeckCodeStore } from "./deckCode";
import { useExportStore } from "./export";
import { useDeckManagementStore } from "./deckManagement";

import type DeckSection from "../components/layout/DeckSection.vue";

export const useAppStore = defineStore("app", () => {
  // Vue 3.5の新機能: Template refs management
  // より柔軟なtemplate ref管理
  // DeckSectionコンポーネントのインスタンス型を定義
  // Vue 3.5の新機能: InstanceType<typeof Component> でコンポーネントインスタンスの型を正確に取得
  type DeckSectionInstance = InstanceType<typeof DeckSection>;
  let deckSectionRef = ref<DeckSectionInstance | null>(null);

  // Vue 3.5の新機能: shallowRef for performance optimization
  // 頻繁に変更されない状態にはshallowRefを使用
  const showResetConfirmModal = ref<boolean>(false);

  // Vue 3.5の新機能: より効率的なストアインスタンス管理
  // Store instances are created lazily and cached
  const getStoreInstances = () => {
    const cardsStore = useCardsStore();
    const deckStore = useDeckStore();
    const filterStore = useFilterStore();
    const deckCodeStore = useDeckCodeStore();
    const exportStore = useExportStore();
    const deckManagementStore = useDeckManagementStore();

    return {
      cardsStore,
      deckStore,
      filterStore,
      deckCodeStore,
      exportStore,
      deckManagementStore,
    };
  };

  // 各ストアのインスタンス取得（遅延初期化）
  const stores = getStoreInstances();

  /**
   * Vue 3.5最適化: デッキリセット処理
   */
  const resetDeck = (): void => {
    showResetConfirmModal.value = true;
  };

  const confirmResetDeck = (): void => {
    stores.deckStore.resetDeckCards();
    stores.deckStore.resetDeckName();
    showResetConfirmModal.value = false;
  };

  const cancelResetDeck = (): void => {
    showResetConfirmModal.value = false;
  };

  /**
   * Vue 3.5最適化: デッキコードからインポート（カードストアとの連携）
   */
  const importDeckFromCode = (): void => {
    stores.deckCodeStore.importDeckFromCode(stores.cardsStore.availableCards);
  };

  /**
   * Vue 3.5最適化: アプリケーション初期化
   * より効率的な非同期処理パターン
   */
  const initializeApp = async (): Promise<void> => {
    try {
      await stores.cardsStore.loadCards();
      stores.deckStore.initializeDeck(stores.cardsStore.availableCards);
      stores.deckCodeStore.generateDeckCodes();
    } catch (error) {
      console.error("Application initialization failed:", error);
      throw error;
    }
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
    ...stores,
  };
});
