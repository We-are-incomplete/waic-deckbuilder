<script setup lang="ts">
import { ref, watchEffect, computed, reactive } from "vue";
import type { Card, DeckCard } from "../../types";
import { handleImageError, getCardImageUrlSafe } from "../../utils";
import { onLongPress } from "@vueuse/core";

interface Props {
  availableCards: readonly Card[];
  sortedAndFilteredCards: readonly Card[];
  deckCards: readonly DeckCard[];
  isLoading: boolean;
  error: string | null;
}

interface Emits {
  (e: "openFilter"): void;
  (e: "addCard", card: Card): void;
  (e: "incrementCard", cardId: string): void;
  (e: "decrementCard", cardId: string): void;
  (e: "openImageModal", cardId: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// デッキにあるカードのマップを作成（パフォーマンス向上のため）
const deckCardMap = computed(() => {
  const map = new Map<string, number>();
  props.deckCards.forEach((deckCard) => {
    map.set(deckCard.card.id, deckCard.count);
  });
  return map;
});

// カードがデッキにあるかどうかとその枚数を取得
const getCardInDeck = (cardId: string) => {
  return deckCardMap.value.get(cardId) || 0;
};

// カード画像を拡大表示（親コンポーネントに委譲）
const openImageModal = (cardId: string) => {
  emit("openImageModal", cardId);
};

// カードクリック処理
const handleCardClick = (card: Card) => {
  const current = getCardInDeck(card.id);
  if (current === 0) {
    emit("addCard", card);
  } else if (current < 4) {
    emit("incrementCard", card.id);
  }
};

// 長押し機能の設定
const cardRefs = reactive(new Map<string, HTMLElement>());
// カードIDごとの長押しstop関数を保存
const cardLongPressStops = reactive(new Map<string, () => void>());
// 前回のカードIDsを保存
const previousCardIds = ref(new Set<string>());

const setCardRef = (el: HTMLElement | null, cardId: string) => {
  if (el) {
    cardRefs.set(cardId, el);
    // 要素が設定されたら即座に長押しイベントのバインディングを試行
    const cardIndex = props.sortedAndFilteredCards.findIndex(
      (card) => card.id === cardId,
    );
    if (cardIndex !== -1 && !cardLongPressStops.has(cardId)) {
      bindLongPress(cardId, cardIndex);
    }
  } else {
    cardRefs.delete(cardId);
  }
};

// 長押しハンドラーをバインド
const bindLongPress = (cardId: string, _cardIndex: number) => {
  const el = cardRefs.get(cardId);
  if (!el) return;

  // 既存のstop関数があれば先にクリーンアップ
  const existingStop = cardLongPressStops.get(cardId);
  if (existingStop) {
    existingStop();
  }

  const stop = onLongPress(el, () => openImageModal(cardId), {
    delay: 500, // 500msで長押し判定
  });
  cardLongPressStops.set(cardId, stop);
};

// 長押しハンドラーをアンバインド
const unbindLongPress = (cardId: string) => {
  const stop = cardLongPressStops.get(cardId);
  if (stop) {
    stop();
    cardLongPressStops.delete(cardId);
  }
};

watchEffect((onCleanup) => {
  // 現在のカードIDsを取得
  const currentCardIds = new Set(
    props.sortedAndFilteredCards.map((card) => card.id),
  );

  // 削除されたカードの長押しハンドラーをアンバインド
  for (const prevCardId of previousCardIds.value) {
    if (!currentCardIds.has(prevCardId)) {
      unbindLongPress(prevCardId);
    }
  }

  // 新しく追加されたカードのみに長押しハンドラーをバインド
  props.sortedAndFilteredCards.forEach((card, index) => {
    // 既にハンドラーが存在する場合はスキップ
    if (!cardLongPressStops.has(card.id)) {
      bindLongPress(card.id, index);
    }
  });

  // 前回のカードIDsを更新
  previousCardIds.value = currentCardIds;

  // コンポーネント終了時に全てのstop関数を呼び出し
  onCleanup(() => {
    for (const stop of cardLongPressStops.values()) {
      stop();
    }
    cardLongPressStops.clear();
  });
});
</script>

<template>
  <div
    class="flex flex-col flex-grow h-1/2 p-1 sm:p-2 overflow-hidden relative z-10"
  >
    <div class="flex items-center justify-between mb-1 px-1">
      <h2
        class="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-1"
      >
        <svg
          class="w-4 h-4"
          fill="oklch(70.7% 0.165 254.624)"
          stroke="currentColor"
          viewBox="0 -960 960 960"
        >
          <path
            d="M120-520v-320h320v320H120Zm0 400v-320h320v320H120Zm400-400v-320h320v320H520Zm0 400v-320h320v320H520ZM200-600h160v-160H200v160Zm400 0h160v-160H600v160Zm0 400h160v-160H600v160Zm-400 0h160v-160H200v160Zm400-400Zm0 240Zm-240 0Zm0-240Z"
          ></path>
        </svg>
        カード一覧
      </h2>
      <button
        @click="emit('openFilter')"
        class="group px-1 sm:px-2 py-0.5 sm:py-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded text-xs font-medium hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-blue-500/25"
        title="フィルター・検索"
      >
        <span class="flex items-center gap-1">
          <svg
            class="w-3 h-3"
            fill="white"
            stroke="currentColor"
            viewBox="0 -960 960 960"
          >
            <path
              d="M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z"
            ></path>
          </svg>
          <span class="hidden sm:inline">検索/絞り込み</span>
          <span class="sm:hidden">検索</span>
        </span>
      </button>
    </div>

    <div
      class="flex-grow overflow-y-auto grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-3 lg:gap-4 p-1 sm:p-2 bg-slate-800/40 backdrop-blur-sm rounded border border-slate-700/50 shadow-xl"
    >
      <div v-if="isLoading" class="col-span-full text-center mt-2 sm:mt-4">
        <div class="flex flex-col items-center gap-1 sm:gap-2 p-2 sm:p-4">
          <div
            class="animate-spin rounded-full h-8 w-8 sm:h-10 sm:w-10 border-4 border-slate-600 border-t-blue-500"
          ></div>
          <div class="text-slate-400 text-center">
            <p class="text-sm sm:text-base font-medium mb-1">読み込み中...</p>
            <p class="text-xs">カードデータを取得しています</p>
          </div>
        </div>
      </div>

      <div v-else-if="error" class="col-span-full text-center mt-2 sm:mt-4">
        <div class="flex flex-col items-center gap-1 sm:gap-2 p-2 sm:p-4">
          <div
            class="w-8 h-8 sm:w-10 sm:h-10 bg-red-500/20 rounded-full flex items-center justify-center"
          >
            <svg
              class="w-4 h-4 sm:w-5 sm:h-5 text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
          </div>
          <div class="text-red-400 text-center">
            <p class="text-sm sm:text-base font-medium mb-1">
              エラーが発生しました
            </p>
            <p class="text-xs">{{ error }}</p>
          </div>
        </div>
      </div>

      <div
        v-else-if="sortedAndFilteredCards.length === 0"
        class="col-span-full text-center mt-2 sm:mt-4"
      >
        <div class="flex flex-col items-center gap-1 sm:gap-2 p-2 sm:p-4">
          <div
            class="w-8 h-8 sm:w-10 sm:h-10 bg-slate-700/50 rounded-full flex items-center justify-center"
          >
            <svg
              class="w-4 h-4 sm:w-5 sm:h-5 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              ></path>
            </svg>
          </div>
          <div class="text-slate-400 text-center">
            <p class="text-sm sm:text-base font-medium mb-1">
              カードが見つかりません
            </p>
            <p class="text-xs">検索条件を変更してみてください</p>
          </div>
        </div>
      </div>

      <div
        v-else
        v-for="card in sortedAndFilteredCards"
        :key="card.id"
        class="group flex flex-col items-center relative transition-all duration-200"
        :title="
          getCardInDeck(card.id) > 0
            ? '長押し: 拡大表示'
            : 'クリック: デッキに追加 / 長押し: 拡大表示'
        "
      >
        <div
          class="w-full relative overflow-hidden rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer active:scale-95"
          :ref="(el) => setCardRef(el as HTMLElement, card.id)"
          @click="handleCardClick(card)"
          @contextmenu.prevent
        >
          <img
            :src="getCardImageUrlSafe(card.id)"
            @error="handleImageError"
            :alt="card.name"
            loading="lazy"
            class="block w-full h-full object-cover transition-transform duration-200 select-none"
          />
          <div
            v-if="getCardInDeck(card.id) === 0"
            class="absolute inset-0 bg-gradient-to-t from-slate-900/50 via-transparent to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          ></div>

          <div
            v-if="getCardInDeck(card.id) > 0"
            class="absolute inset-0 bg-gradient-to-t from-slate-900/50 via-transparent to-transparent pointer-events-none"
          ></div>
        </div>

        <!-- デッキにあるカードの場合は枚数と増減ボタンを表示 -->
        <div
          v-if="getCardInDeck(card.id) > 0"
          class="absolute bottom-2 w-full px-1 flex items-center justify-center gap-1"
        >
          <button
            @click="emit('decrementCard', card.id)"
            class="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-full flex items-center justify-center leading-none transition-all duration-200 shadow-lg hover:shadow-red-500/25"
          >
            <svg
              class="w-3 h-3 sm:w-4 sm:h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M20 12H4"
              ></path>
            </svg>
          </button>
          <div
            class="w-7 h-6 sm:w-9 sm:h-8 font-bold text-center flex items-center justify-center bg-slate-900/80 backdrop-blur-sm rounded-lg border border-slate-600/50 text-white text-sm sm:text-base"
          >
            {{ getCardInDeck(card.id) }}
          </div>
          <button
            @click="emit('incrementCard', card.id)"
            class="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-full flex items-center justify-center leading-none transition-all duration-200 shadow-lg hover:shadow-emerald-500/25 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed"
            :disabled="getCardInDeck(card.id) >= 4"
          >
            <svg
              class="w-3 h-3 sm:w-4 sm:h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              ></path>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
