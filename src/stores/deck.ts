/**
 * DeckStore（src/stores/deck.ts）
 * 目的: デッキ（カード配列・名称・派生状態）の集中管理とローカルストレージ永続化。
 * 公開API: add/increment/decrement/remove/reset/initialize/set 等（下部参照）。
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
  DEFAULT_DECK_NAME,
} from "../utils";
import {
  calculateDeckState,
  executeDeckOperation,
  sortDeckCards,
} from "../domain";
import { useDebounceFn, useEventListener } from "@vueuse/core";

export const useDeckStore = defineStore("deck", () => {
  // Vue 3.5の新機能: shallowRef for array performance optimization
  // DeckCard配列の深い監視は不要な場合が多いためshallowRefを使用
  const deckCards = shallowRef<readonly DeckCard[]>([]);
  const deckName = ref<string>(DEFAULT_DECK_NAME);

  /**
   * 成功時の共通処理：デッキカードを更新
   */
  const updateDeckCard = (newCards: readonly DeckCard[]): void => {
    deckCards.value = [...newCards];
  };

  /**
   * Vue 3.5最適化: ソート済みデッキカード
   */
  const sortedDeckCards = computed(() => sortDeckCards(deckCards.value));

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
    if (deckState.value.type !== "invalid") return [] as const;
    return deckState.value.errors.map((e) => {
      switch (e.type) {
        case "CardNotFound":
          return `カードが見つかりません: ${e.cardId}`;
        case "MaxCountExceeded":
          return `最大枚数を超過しました: ${e.cardId} (最大: ${e.maxCount ?? "不明"})`;
        case "InvalidCardCount":
          return `不正なカード枚数です: ${e.cardId} (指定: ${e.count ?? "不明"})`;
        default:
          return "不明なエラー";
      }
    });
  });

  const applyOperation = (
    operation: Parameters<typeof executeDeckOperation>[1],
    onErrMsg: string,
  ): boolean => {
    try {
      const result = executeDeckOperation(deckCards.value, operation);
      updateDeckCard(result);
      return true;
    } catch (error) {
      console.error(`${onErrMsg}:`, error);
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
  let suppressSave = false;
  const tryResetDeckCards = (): void => {
    try {
      resetDeckCardsInLocalStorage();
    } catch (e) {
      console.error("不正デッキのクリアに失敗しました", e);
    }
  };

  const tryResetDeckName = (): void => {
    try {
      resetDeckNameInLocalStorage();
    } catch (e) {
      console.error("デッキ名のクリアに失敗しました", e);
    }
  };
  const initializeDeck = (availableCards: readonly Card[]): void => {
    const prev = suppressSave;
    suppressSave = true;
    try {
      // デッキカードの読み込み
      try {
        const loadedDeck = loadDeckFromLocalStorage(availableCards);
        const s = calculateDeckState(loadedDeck);
        switch (s.type) {
          case "invalid":
            updateDeckCard([]);
            console.error("保存されたデッキが不正です", s.errors);
            // 永続化された不正データをクリアして再発を防止
            tryResetDeckCards();
            break;
          case "empty":
            updateDeckCard([]);
            break;
          default:
            updateDeckCard(s.cards);
        }
      } catch (e) {
        updateDeckCard([]);
        console.error("デッキの読み込みに失敗しました", e);
      }

      // デッキ名の読み込み（独立して処理）
      try {
        const loadedName = loadDeckName();
        const n = loadedName.trim();
        deckName.value = n || DEFAULT_DECK_NAME;
      } catch (e) {
        deckName.value = DEFAULT_DECK_NAME;
        console.error("デッキ名の読み込みに失敗しました", e);
        tryResetDeckName();
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
      console.error("無効なデッキです", state.errors);
      return;
    }
    if (state.type === "empty") updateDeckCard([]);
    else updateDeckCard(state.cards);
  };

  /**
   * Vue 3.5最適化: デッキカードをリセット
   */
  const resetDeckCards = () => {
    try {
      resetDeckCardsInLocalStorage();
    } catch (r) {
      console.error("デッキカードのリセットに失敗しました", r);
      return;
    }
    const prev = suppressSave;
    suppressSave = true;
    try {
      updateDeckCard([]);
    } finally {
      suppressSave = prev;
    }
  };

  /**
   * デッキ名をリセット
   */
  const resetDeckName = () => {
    try {
      resetDeckNameInLocalStorage();
    } catch (r) {
      console.error("デッキ名のリセットに失敗しました", r);
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
   * - ユーザー入力の一時的な空文字や前後空白は許容する（保存時に正規化）
   */
  const setDeckName = (name: string): void => {
    if (deckName.value === name) return;
    deckName.value = name;
  };

  // Vue 3.5の新機能: より効率的なデバウンス処理
  // maxWaitオプションで最大待機時間を制限し、ページアンロード時の保存漏れを防ぐ
  type FlushableFn<T extends unknown[]> = ((...args: T) => void) & {
    flush: () => void;
    cancel: () => void;
  };
  const debouncedSave = useDebounceFn(
    (cards: readonly DeckCard[]) => {
      try {
        saveDeckToLocalStorage(cards);
      } catch (e) {
        console.error("デッキの保存に失敗しました", e);
      }
    },
    500,
    { maxWait: 2000 },
  ) as unknown as FlushableFn<[readonly DeckCard[]]>;

  const debouncedSaveName = useDebounceFn(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return; // 空は保存しない（次の有効入力まで待つ）
      try {
        saveDeckName(trimmed);
      } catch (e) {
        console.error("デッキ名の保存に失敗しました", e);
      }
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
    try {
      saveDeckToLocalStorage(deckCards.value);
    } catch (r1) {
      console.error("デッキの即時保存に失敗しました", r1);
    }
    try {
      const trimmed = deckName.value.trim();
      if (trimmed) saveDeckName(trimmed);
    } catch (r2) {
      console.error("デッキ名の即時保存に失敗しました", r2);
    }
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
