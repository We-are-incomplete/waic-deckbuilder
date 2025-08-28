import { defineStore } from "pinia";
import { ref, computed, watch, readonly, shallowRef } from "vue";
import type { Card, DeckCard } from "../types";
import {
  saveDeckToLocalStorage,
  loadDeckFromLocalStorage,
  saveDeckName,
  loadDeckName,
  resetDeckCardsInLocalStorage,
  resetDeckNameInLocalStorage,
  createVersionedState,
  createArraySortMemo,
  createErrorHandler,
} from "../utils";
import {
  calculateDeckState,
  executeDeckOperation,
  sortDeckCards,
} from "../domain";
import { useDebounceFn, useEventListener } from "@vueuse/core";

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
  const { version: deckVersion, incrementVersion } = createVersionedState();

  // エラーハンドラー
  const errorHandler = createErrorHandler();

  /**
   * 成功時の共通処理：デッキカードを更新してバージョンをインクリメント
   */
  const updateDeckCardsWithVersion = (newCards: readonly DeckCard[]): void => {
    deckCards.value = [...newCards];
    incrementVersion();
  };

  /**
   * Vue 3.5最適化: デッキハッシュ（メモ化キー用）
   */
  const deckHash = computed(() => {
    return generateDeckHash(deckCards.value);
  });

  // メモ化されたソート処理
  const memoizedSortDeckCards = createArraySortMemo(
    (cards: readonly DeckCard[]): readonly DeckCard[] => sortDeckCards(cards),
  );

  /**
   * Vue 3.5最適化: ソート済みデッキカード
   */
  const sortedDeckCards = computed(() => {
    return memoizedSortDeckCards(deckCards.value);
  });

  /**
   * Vue 3.5最適化: デッキの合計枚数
   */
  const totalDeckCards = computed(() => {
    return deckCards.value.reduce(
      (sum: number, item: DeckCard) => sum + item.count,
      0,
    );
  });

  /**
   * Vue 3.5最適化: デッキの状態情報
   */
  const deckState = computed(() => {
    return calculateDeckState(deckCards.value);
  });

  /**
   * Vue 3.5最適化: デッキのエラーメッセージ
   */
  const deckErrors = computed(() => {
    return deckState.value.type === "invalid" ? deckState.value.errors : [];
  });

  /**
   * Vue 3.5最適化: カードをデッキに追加
   */
  const addCardToDeck = (card: Card): void => {
    const result = executeDeckOperation(deckCards.value, {
      type: "addCard",
      card,
    });

    if (result.isOk()) {
      updateDeckCardsWithVersion(result.value);
    } else {
      errorHandler.handleValidationError(
        `カードの追加に失敗しました: ${result.error.type}`,
      );
    }
  };

  /**
   * Vue 3.5最適化: カード枚数を増やす
   */
  const incrementCardCount = (cardId: string): void => {
    const result = executeDeckOperation(deckCards.value, {
      type: "incrementCount",
      cardId,
    });

    if (result.isOk()) {
      updateDeckCardsWithVersion(result.value);
    } else {
      errorHandler.handleValidationError(
        `カード枚数の増加に失敗しました: ${result.error.type}`,
      );
    }
  };

  /**
   * Vue 3.5最適化: カード枚数を減らす
   */
  const decrementCardCount = (cardId: string): void => {
    const result = executeDeckOperation(deckCards.value, {
      type: "decrementCount",
      cardId,
    });

    if (result.isOk()) {
      updateDeckCardsWithVersion(result.value);
    } else {
      errorHandler.handleValidationError(
        `カード枚数の減少に失敗しました: ${result.error.type}`,
      );
    }
  };

  /**
   * Vue 3.5最適化: カードをデッキから削除
   */
  const removeCardFromDeck = (cardId: string): void => {
    const result = executeDeckOperation(deckCards.value, {
      type: "removeCard",
      cardId,
    });

    if (result.isOk()) {
      updateDeckCardsWithVersion(result.value);
    } else {
      errorHandler.handleValidationError(
        `カードの削除に失敗しました: ${result.error.type}`,
      );
    }
  };

  /**
   * Vue 3.5最適化: ローカルストレージからデッキを初期化
   */
  const initializeDeck = (availableCards: readonly Card[]): void => {
    const loadDeckResult = loadDeckFromLocalStorage(availableCards);
    if (loadDeckResult.isErr()) {
      updateDeckCardsWithVersion([]);
      errorHandler.handleRuntimeError(
        "デッキの読み込みに失敗しました",
        loadDeckResult.error,
      );
    } else {
      updateDeckCardsWithVersion(loadDeckResult.value);
    }

    const loadNameResult = loadDeckName();
    if (loadNameResult.isErr()) {
      deckName.value = "新しいデッキ";
      errorHandler.handleRuntimeError(
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
  const setDeckCards = (cards: readonly DeckCard[]) => {
    updateDeckCardsWithVersion(cards);
  };

  /**
   * Vue 3.5最適化: デッキカードをリセット
   */
  const resetDeckCards = () => {
    updateDeckCardsWithVersion([]);
    const r = resetDeckCardsInLocalStorage();
    if (r.isErr()) {
      errorHandler.handleRuntimeError(
        "デッキカードのリセットに失敗しました",
        r.error,
      );
    }
  };

  /**
   * デッキ名をリセット
   */
  const resetDeckName = () => {
    deckName.value = "新しいデッキ";
    resetDeckNameInLocalStorage();
  };

  /**
   * デッキ名を設定
   */
  const setDeckName = (name: string): void => {
    deckName.value = name;
  };

  // Vue 3.5の新機能: より効率的なデバウンス処理
  // maxWaitオプションで最大待機時間を制限し、ページアンロード時の保存漏れを防ぐ
  type FlushableFn<T extends any[]> = ((...args: T) => void) & {
    flush: () => void;
    cancel: () => void;
  };
  const debouncedSave = useDebounceFn(
    (cards: DeckCard[]) => {
      saveDeckToLocalStorage(cards);
    },
    500,
    { maxWait: 2000 },
  ) as unknown as FlushableFn<[DeckCard[]]>;

  const debouncedSaveName = useDebounceFn(
    (name: string) => {
      saveDeckName(name);
    },
    500,
    { maxWait: 2000 },
  ) as unknown as FlushableFn<[string]>;

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
    // 未処理のデバウンスを反映/無効化してから直接保存
    debouncedSave.flush?.();
    debouncedSaveName.flush?.();
    // 念のため後続の遅延保存を打ち切る
    debouncedSave.cancel?.();
    debouncedSaveName.cancel?.();
    saveDeckToLocalStorage(deckCards.value);
    saveDeckName(deckName.value);
  };

  // ブラウザ環境でのみイベントリスナーを設定
  if (typeof window !== "undefined") {
    useEventListener(window, "beforeunload", handleBeforeUnload);
    useEventListener(window, "pagehide", handleBeforeUnload);
    if (typeof document !== "undefined") {
      useEventListener(document, "visibilitychange", () => {
        if (document.visibilityState === "hidden") handleBeforeUnload();
      });
    }
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
