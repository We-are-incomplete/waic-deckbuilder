/**
 * Spec: App Store
 * 目的: アプリ全体のUI状態（リセット確認モーダル、初期化フロー、デッキ操作）を管理する。
 * 契約:
 * - showResetConfirmModal: 読み取り専用。resetDeck/confirmResetDeck/cancelResetDeck でのみ変更。
 * - initializeApp: カード読み込み失敗時は早期 return して後続副作用を停止。
 * 非目標: ビジネスロジックは各ストアへ委譲（最小API表面）。
 */
import { defineStore } from "pinia";
import { ref, readonly } from "vue";
import { useCardsStore } from "./cards";
import { useDeckStore } from "./deck";
import { useFilterStore } from "./filter";

import { useDeckCodeStore } from "./deckCode";
import { useExportStore } from "./export";
import { useDeckManagementStore } from "./deckManagement";

export const useAppStore = defineStore("app", () => {
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
   * デッキ名の一元的な更新窓口
   */
  const setDeckName = (name: string): void => {
    deckStore.setDeckName(name);
  };

  /**
   * 保存デッキの読み込み（名前とコードを一括適用）
   */
  const loadSavedDeck = (name: string, code: string): void => {
    deckStore.setDeckName(name);
    deckCodeStore.setImportDeckCode(code);
    importDeckFromCode();
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
    // Reset state
    showResetConfirmModal: readonly(showResetConfirmModal),

    // Reset actions
    resetDeck,
    confirmResetDeck,
    cancelResetDeck,

    // Deck code actions
    importDeckFromCode,
    setDeckName,
    loadSavedDeck,

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
