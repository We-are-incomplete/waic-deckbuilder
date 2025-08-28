/**
 * DeckStore（src/stores/deck.ts）
 * 目的: デッキ（カード配列・名称・派生状態）の集中管理とローカルストレージ永続化。
 * 公開API: add/increment/decrement/remove/reset/initialize/set 等（下部参照）。
 * 例外方針: 例外は投げず neverthrow の Result を受け取り errorHandler に委譲。
 * 不変条件: DeckCard 配列は参照整合性を保ち、外部からは readonly で公開。
 */
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
  DEFAULT_DECK_NAME,
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

  // カードIDと枚数のタプル配列をソートし、JSON化して衝突を回避
  const entries = deckCards
    .map((dc) => [dc.card.id, dc.count] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return JSON.stringify(entries);
};

export const useDeckStore = defineStore("deck", () => {
  // Vue 3.5の新機能: shallowRef for array performance optimization
  // DeckCard配列の深い監視は不要な場合が多いためshallowRefを使用
  const deckCards = shallowRef<readonly DeckCard[]>([]);
  const deckName = ref<string>(DEFAULT_DECK_NAME);

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

  const applyOperation = <T extends Parameters<typeof executeDeckOperation>[1]>(
    operation: T,
    onErrMsg: string,
  ): boolean => {
    const result = executeDeckOperation(deckCards.value, operation);
    if (result.isOk()) {
      updateDeckCardsWithVersion(result.value);
      return true;
    }
    {
      // 構造化エラーを渡す（handleValidationError(message, detail) を想定）
      errorHandler.handleValidationError(onErrMsg, result.error);
      return false;
    }
  };

  /**
   * Vue 3.5最適化: カードをデッキに追加
   */
  const addCardToDeck = (card: Card): boolean =>
    applyOperation({ type: "addCard", card }, "カードの追加に失敗しました");

  /**
   * Vue 3.5最適化: カード枚数を増やす
   */
  const incrementCardCount = (cardId: string): boolean =>
    applyOperation(
      { type: "incrementCount", cardId },
      "カード枚数の増加に失敗しました",
    );

  /**
   * Vue 3.5最適化: カード枚数を減らす
   */
  const decrementCardCount = (cardId: string): boolean =>
    applyOperation(
      { type: "decrementCount", cardId },
      "カード枚数の減少に失敗しました",
    );

  /**
   * Vue 3.5最適化: カードをデッキから削除
   */
  const removeCardFromDeck = (cardId: string): boolean =>
    applyOperation(
      { type: "removeCard", cardId },
      "カードの削除に失敗しました",
    );

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
      deckName.value = DEFAULT_DECK_NAME;
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
    const state = calculateDeckState(cards);
    if (state.type === "invalid") {
      errorHandler.handleValidationError("無効なデッキです", state.errors);
      return;
    }
    updateDeckCardsWithVersion(cards);
  };

  /**
   * Vue 3.5最適化: デッキカードをリセット
   */
  const resetDeckCards = () => {
    const r = resetDeckCardsInLocalStorage();
    if (r.isErr()) {
      errorHandler.handleRuntimeError(
        "デッキカードのリセットに失敗しました",
        r.error,
      );
      return;
    }
    updateDeckCardsWithVersion([]);
  };

  /**
   * デッキ名をリセット
   */
  const resetDeckName = () => {
    const r = resetDeckNameInLocalStorage();
    if (r.isErr()) {
      errorHandler.handleRuntimeError(
        "デッキ名のリセットに失敗しました",
        r.error,
      );
      return;
    }
    deckName.value = DEFAULT_DECK_NAME;
  };

  /**
   * デッキ名を設定
   */
  const setDeckName = (name: string): void => {
    const n = name.trim() || DEFAULT_DECK_NAME;
    if (deckName.value === n) return;
    deckName.value = n;
  };

  // Vue 3.5の新機能: より効率的なデバウンス処理
  // maxWaitオプションで最大待機時間を制限し、ページアンロード時の保存漏れを防ぐ
  type FlushableFn<T extends unknown[]> = ((...args: T) => void) & {
    flush: () => void;
    cancel: () => void;
  };
  const debouncedSave = useDebounceFn(
    (cards: readonly DeckCard[]) => {
      const r = saveDeckToLocalStorage(cards);
      if (r.isErr()) {
        errorHandler.handleRuntimeError("デッキの保存に失敗しました", r.error);
      }
    },
    500,
    { maxWait: 2000 },
  ) as unknown as FlushableFn<[readonly DeckCard[]]>;

  const debouncedSaveName = useDebounceFn(
    (name: string) => {
      const r = saveDeckName(name);
      if (r.isErr()) {
        errorHandler.handleRuntimeError(
          "デッキ名の保存に失敗しました",
          r.error,
        );
      }
    },
    500,
    { maxWait: 2000 },
  ) as unknown as FlushableFn<[string]>;

  // Vue 3.5最適化: watch で副作用を管理（shallowRef なので浅い監視で十分）
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
  let lastImmediateSaveAt = 0;
  const handleBeforeUnload = () => {
    const now = Date.now();
    if (now - lastImmediateSaveAt < 500) return;
    lastImmediateSaveAt = now;
    // 未処理のデバウンスを反映/無効化してから直接保存
    debouncedSave.flush?.();
    debouncedSaveName.flush?.();
    // 念のため後続の遅延保存を打ち切る
    debouncedSave.cancel?.();
    debouncedSaveName.cancel?.();
    const r1 = saveDeckToLocalStorage(deckCards.value);
    if (r1.isErr())
      errorHandler.handleRuntimeError(
        "デッキの即時保存に失敗しました",
        r1.error,
      );
    const r2 = saveDeckName(deckName.value);
    if (r2.isErr())
      errorHandler.handleRuntimeError(
        "デッキ名の即時保存に失敗しました",
        r2.error,
      );
  };

  // ブラウザ環境でのみイベントリスナーを設定
  if (typeof window !== "undefined") {
    useEventListener(window, "beforeunload", handleBeforeUnload);
    useEventListener(window, "pagehide", (e: PageTransitionEvent) => {
      if (!e.persisted) handleBeforeUnload();
    });
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
