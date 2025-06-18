import { defineStore } from "pinia";
import { ref, computed, watch, readonly, shallowRef, onMounted, onBeforeUnmount } from "vue";
import type { Card, DeckCard } from "../types";
import {
  saveDeckToLocalStorage,
  loadDeckFromLocalStorage,
  saveDeckName,
  loadDeckName,
  removeDeckCardsFromLocalStorage,
  removeDeckNameFromLocalStorage,
} from "../utils";
import { createErrorHandler } from "../utils/errorHandler";
import * as DeckDomain from "../domain/deck";
import { sortDeckCards } from "../domain/sort";
import { useDebounceFn } from "@vueuse/core";

// beforeunloadイベントリスナーの重複登録を防ぐフラグ
let isBeforeUnloadListenerRegistered = false;

/**
 * デッキの軽量ハッシュを生成する純粋関数
 * 巨大なオブジェクトの代わりに軽量なキーを使用してメモ化を最適化
 */
const generateDeckHash = (deckCards: readonly DeckCard[]): string => {
  if (deckCards.length === 0) {
    return "empty";
  }

  // カードIDと枚数のペアを連結した軽量なハッシュ
  const cardEntries = deckCards
    .map((card) => `${card.card.id}:${card.count}`)
    .sort() // 順序を統一してキャッシュヒット率を向上
    .join("|");

  return `${deckCards.length}:${cardEntries}`;
};

export const useDeckStore = defineStore("deck", () => {
  // Vue 3.5の新機能: shallowRef for array performance optimization
  // DeckCard配列の深い監視は不要な場合が多いためshallowRefを使用
  const deckCards = shallowRef<DeckCard[]>([]);
  const deckName = ref<string>("新しいデッキ");

  // メモ化最適化用のバージョン管理
  const deckVersion = ref<number>(0);

  // エラーハンドラー
  const errorHandler = computed(() => createErrorHandler());

  /**
   * Vue 3.5最適化: デッキハッシュ（メモ化キー用）
   */
  const deckHash = computed(() => {
    return generateDeckHash(deckCards.value);
  });

  /**
   * Vue 3.5最適化: ソート済みデッキカード
   */
  const sortedDeckCards = computed(() => {
    return readonly(sortDeckCards(deckCards.value));
  });

  /**
   * Vue 3.5最適化: デッキの合計枚数
   */
  const totalDeckCards = computed(() => {
    return deckCards.value.reduce((sum: number, item: DeckCard) => sum + item.count, 0);
  });

  /**
   * Vue 3.5最適化: デッキの状態情報
   */
  const deckState = computed(() => {
    return DeckDomain.calculateDeckState(deckCards.value);
  });

  /**
   * Vue 3.5最適化: デッキのエラーメッセージ
   */
  const deckErrors = computed(() => {
    return deckState.value.type === "invalid" ? deckState.value.errors : [];
  });

  /**
   * Vue 3.5最適化: 効率的な配列更新ヘルパー
   */
  const updateDeckCards = (newCards: DeckCard[]): void => {
    deckCards.value = newCards;
    deckVersion.value++; // バージョンを更新してメモ化キャッシュを無効化
  };

  /**
   * Vue 3.5最適化: カードをデッキに追加
   */
  const addCardToDeck = (card: Card): void => {
    const result = DeckDomain.executeDeckOperation(deckCards.value, {
      type: "addCard",
      card,
    });

    if (result.isOk()) {
      updateDeckCards([...result.value]);
    } else {
      errorHandler.value.handleValidationError(`カードの追加に失敗しました: ${result.error.type}`);
    }
  };

  /**
   * Vue 3.5最適化: カード枚数を増やす
   */
  const incrementCardCount = (cardId: string): void => {
    const result = DeckDomain.executeDeckOperation(deckCards.value, {
      type: "incrementCount",
      cardId,
    });

    if (result.isOk()) {
      updateDeckCards([...result.value]);
    } else {
      errorHandler.value.handleValidationError(
        `カード枚数の増加に失敗しました: ${result.error.type}`,
      );
    }
  };

  /**
   * Vue 3.5最適化: カード枚数を減らす
   */
  const decrementCardCount = (cardId: string): void => {
    const result = DeckDomain.executeDeckOperation(deckCards.value, {
      type: "decrementCount",
      cardId,
    });

    if (result.isOk()) {
      updateDeckCards([...result.value]);
    } else {
      errorHandler.value.handleValidationError(
        `カード枚数の減少に失敗しました: ${result.error.type}`,
      );
    }
  };

  /**
   * Vue 3.5最適化: カードをデッキから削除
   */
  const removeCardFromDeck = (cardId: string): void => {
    const result = DeckDomain.executeDeckOperation(deckCards.value, {
      type: "removeCard",
      cardId,
    });

    if (result.isOk()) {
      updateDeckCards([...result.value]);
    } else {
      errorHandler.value.handleValidationError(`カードの削除に失敗しました: ${result.error.type}`);
    }
  };

  /**
   * Vue 3.5最適化: ローカルストレージからデッキを初期化
   */
  const initializeDeck = (availableCards: readonly Card[]): void => {
    const loadDeckResult = loadDeckFromLocalStorage(availableCards);
    if (loadDeckResult.isErr()) {
      updateDeckCards([]);
      errorHandler.value.handleRuntimeError("デッキの読み込みに失敗しました", loadDeckResult.error);
    } else {
      updateDeckCards(loadDeckResult.value);
    }

    const loadNameResult = loadDeckName();
    if (loadNameResult.isErr()) {
      deckName.value = "新しいデッキ";
      errorHandler.value.handleRuntimeError(
        "デッキ名の読み込みに失敗しました",
        loadNameResult.error,
      );
    } else {
      deckName.value = loadNameResult.value;
    }
  };

  /**
   * Vue 3.5最適化: デッキカードを設定
   */
  const setDeckCards = (cards: DeckCard[]) => {
    updateDeckCards(cards);
  };

  /**
   * Vue 3.5最適化: デッキカードをリセット
   */
  const resetDeckCards = () => {
    updateDeckCards([]);
    removeDeckCardsFromLocalStorage();
  };

  /**
   * デッキ名をリセット
   */
  const resetDeckName = () => {
    deckName.value = "新しいデッキ";
    removeDeckNameFromLocalStorage();
  };

  /**
   * デッキ名を設定
   */
  const setDeckName = (name: string): void => {
    deckName.value = name;
  };

  // Vue 3.5の新機能: より効率的なデバウンス処理
  // maxWaitオプションで最大待機時間を制限し、ページアンロード時の保存漏れを防ぐ
  const debouncedSave = useDebounceFn(
    (cards: DeckCard[]) => {
      saveDeckToLocalStorage(cards);
    },
    500,
    { maxWait: 2000 },
  );

  const debouncedSaveName = useDebounceFn(
    (name: string) => {
      saveDeckName(name);
    },
    500,
    { maxWait: 2000 },
  );

  // Vue 3.5最適化: watchEffect for better side effect management
  watch(
    deckCards,
    (newCards) => {
      debouncedSave(newCards);
    },
    { deep: false, flush: "post" }, // shallowRefなので浅い監視で十分
  );

  watch(deckName, (newName) => {
    debouncedSaveName(newName);
  });

  // ページアンロード時の保存保証
  const handleBeforeUnload = () => {
    // デバウンス関数をバイパスして直接保存処理を実行
    saveDeckToLocalStorage(deckCards.value);
    saveDeckName(deckName.value);
  };

  // ブラウザ環境でのみイベントリスナーを設定
  if (typeof window !== "undefined" && !isBeforeUnloadListenerRegistered) {
    onMounted(() => {
      window.addEventListener("beforeunload", handleBeforeUnload);
      isBeforeUnloadListenerRegistered = true;
    });

    onBeforeUnmount(() => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      isBeforeUnloadListenerRegistered = false;
      // コンポーネント破棄時にも保存を実行
      handleBeforeUnload();
    });
  } else if (typeof window !== "undefined" && isBeforeUnloadListenerRegistered) {
    // 既にリスナーが登録されている場合は、アンマウント時の処理のみ追加
    onBeforeUnmount(() => {
      // コンポーネント破棄時にも保存を実行
      handleBeforeUnload();
    });
  }

  return {
    // State
    deckCards: readonly(deckCards),
    deckName: readonly(deckName),

    // Computed
    sortedDeckCards,
    totalDeckCards,
    deckState,
    deckErrors,
    deckHash, // メモ化最適化用の軽量ハッシュ
    deckVersion, // メモ化最適化用のバージョン

    // Actions
    addCardToDeck,
    incrementCardCount,
    decrementCardCount,
    removeCardFromDeck,
    initializeDeck,
    setDeckCards,
    resetDeckCards,
    resetDeckName,
    setDeckName,
  };
});
