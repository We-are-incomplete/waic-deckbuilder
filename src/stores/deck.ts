/**
 * DeckStore（src/stores/deck.ts）
 * 目的: デッキ（カード配列・名称・派生状態）の集中管理とローカルストレージ永続化。
 * 公開API: add/increment/decrement/remove/reset/initialize/set 等（下部参照）。
 * 例外方針: 例外は投げず、Effectで失敗を表現し errorHandler に委譲。
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
  deckOperationErrorToString,
  DEFAULT_DECK_NAME,
} from "../utils";
import {
  calculateDeckState,
  executeDeckOperation,
  sortDeckCards,
} from "../domain";
import { useDebounceFn, useEventListener } from "@vueuse/core";
import { Effect } from "effect";

const runEitherSync = <A, E>(eff: Effect.Effect<A, E>) =>
  Effect.runSync(Effect.either(eff));

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
    .sort((a, b) => a[0].localeCompare(b[0]));
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
  const deckErrors = computed<readonly string[]>(() => {
    return deckState.value.type === "invalid"
      ? deckState.value.errors.map(deckOperationErrorToString)
      : [];
  });

  const applyOperation = (
    operation: Parameters<typeof executeDeckOperation>[1],
    onErrMsg: string,
  ): boolean => {
    const result = runEitherSync(
      executeDeckOperation(deckCards.value, operation),
    );
    if (result._tag === "Left") {
      errorHandler.handleValidationError(onErrMsg, result.left);
      return false;
    }
    updateDeckCardsWithVersion(result.right);
    return true;
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
  let suppressSave = false;
  const initializeDeck = (availableCards: readonly Card[]): void => {
    const prev = suppressSave;
    suppressSave = true;
    try {
      const loadDeckResult = runEitherSync(
        loadDeckFromLocalStorage(availableCards),
      );

      if (loadDeckResult._tag === "Left") {
        updateDeckCardsWithVersion([]);
        errorHandler.handleRuntimeError(
          "デッキの読み込みに失敗しました",
          loadDeckResult.left,
        );
        return;
      }

      const s = calculateDeckState(loadDeckResult.right);
      switch (s.type) {
        case "invalid":
          updateDeckCardsWithVersion([]);
          errorHandler.handleValidationError(
            "保存されたデッキが不正です",
            s.errors,
          );
          // 永続化された不正データをクリアして再発を防止
          {
            const rr = runEitherSync(resetDeckCardsInLocalStorage());
            if (rr._tag === "Left") {
              errorHandler.handleRuntimeError(
                "不正デッキのクリアに失敗しました",
                rr.left,
              );
            }
          }
          break;
        case "empty":
          updateDeckCardsWithVersion([]);
          break;
        default:
          updateDeckCardsWithVersion(s.cards);
      }

      const loadNameResult = runEitherSync(loadDeckName());

      if (loadNameResult._tag === "Left") {
        deckName.value = DEFAULT_DECK_NAME;
        errorHandler.handleRuntimeError(
          "デッキ名の読み込みに失敗しました",
          loadNameResult.left,
        );
        const rn = runEitherSync(resetDeckNameInLocalStorage());
        if (rn._tag === "Left") {
          errorHandler.handleRuntimeError(
            "デッキ名のクリアに失敗しました",
            rn.left,
          );
        }
      } else {
        const n = loadNameResult.right.trim();
        deckName.value = n || DEFAULT_DECK_NAME;
      }
    } finally {
      suppressSave = prev;
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
    if (state.type === "empty") updateDeckCardsWithVersion([]);
    else updateDeckCardsWithVersion(state.cards);
  };

  /**
   * Vue 3.5最適化: デッキカードをリセット
   */
  const resetDeckCards = () => {
    const r = runEitherSync(resetDeckCardsInLocalStorage());
    if (r._tag === "Left") {
      errorHandler.handleRuntimeError(
        "デッキカードのリセットに失敗しました",
        r.left,
      );
      return;
    }
    const prev = suppressSave;
    suppressSave = true;
    try {
      updateDeckCardsWithVersion([]);
    } finally {
      suppressSave = prev;
    }
  };

  /**
   * デッキ名をリセット
   */
  const resetDeckName = () => {
    const r = runEitherSync(resetDeckNameInLocalStorage());
    if (r._tag === "Left") {
      errorHandler.handleRuntimeError(
        "デッキ名のリセットに失敗しました",
        r.left,
      );
      return;
    }
    const prev = suppressSave;
    suppressSave = true;
    try {
      deckName.value = DEFAULT_DECK_NAME;
    } finally {
      suppressSave = prev;
    }
  };

  /**
   * デッキ名を設定
   */
  const setDeckName = (name: string): void => {
    const n = name.trim();
    if (!n) {
      resetDeckName();
      return;
    }
    if (deckName.value === n) {
      return;
    }
    deckName.value = n;
  };

  const runAndReport = <A, E>(eff: Effect.Effect<A, E>, msg: string) => {
    const r = runEitherSync(eff);
    if (r._tag === "Left") errorHandler.handleRuntimeError(msg, r.left);
    return r;
  };

  // Vue 3.5の新機能: より効率的なデバウンス処理
  // maxWaitオプションで最大待機時間を制限し、ページアンロード時の保存漏れを防ぐ
  type FlushableFn<T extends unknown[]> = ((...args: T) => void) & {
    flush: () => void;
    cancel: () => void;
  };
  const debouncedSave = useDebounceFn(
    (cards: readonly DeckCard[]) => {
      runAndReport(saveDeckToLocalStorage(cards), "デッキの保存に失敗しました");
    },
    500,
    { maxWait: 2000 },
  ) as unknown as FlushableFn<[readonly DeckCard[]]>;

  const debouncedSaveName = useDebounceFn(
    (name: string) => {
      runAndReport(saveDeckName(name), "デッキ名の保存に失敗しました");
    },
    500,
    { maxWait: 2000 },
  ) as unknown as FlushableFn<[string]>;

  // Vue 3.5最適化: watch で副作用を管理（shallowRef なので浅い監視で十分）
  watch(
    deckCards,
    (newCards) => {
      if (!suppressSave) debouncedSave(newCards);
    },
    { deep: false, flush: "post" }, // shallowRefなので浅い監視で十分
  );

  watch(deckName, (newName) => {
    if (!suppressSave) debouncedSaveName(newName);
  });

  // ページアンロード時の保存保証
  let lastImmediateSaveAt = 0;
  const MIN_SAVE_INTERVAL_MS = 500 as const;
  const nowMs = () =>
    typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();
  const handleBeforeUnload = () => {
    const now = nowMs();
    if (now - lastImmediateSaveAt < MIN_SAVE_INTERVAL_MS) return;
    lastImmediateSaveAt = now;
    // 未処理のデバウンスを反映/無効化してから直接保存
    debouncedSave.flush?.();
    debouncedSaveName.flush?.();
    // 念のため後続の遅延保存を打ち切る
    debouncedSave.cancel?.();
    debouncedSaveName.cancel?.();
    const r1 = runEitherSync(saveDeckToLocalStorage(deckCards.value));
    if (r1._tag === "Left")
      errorHandler.handleRuntimeError(
        "デッキの即時保存に失敗しました",
        r1.left,
      );
    const r2 = runEitherSync(saveDeckName(deckName.value));
    if (r2._tag === "Left")
      errorHandler.handleRuntimeError(
        "デッキ名の即時保存に失敗しました",
        r2.left,
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
