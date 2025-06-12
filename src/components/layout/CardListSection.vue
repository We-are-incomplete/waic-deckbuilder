<script setup lang="ts">
import { ref, watchEffect, computed, shallowReactive } from "vue";
import type { Card, DeckCard } from "../../types";
import { handleImageError } from "../../utils/image";
import { getCardImageUrlSafe } from "../../utils";
import { CardImageModal } from "../index";
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

// モーダルの状態
const isImageModalVisible = ref(false);
const selectedCardImage = ref<string | null>(null);
const selectedCard = ref<Card | null>(null);
const selectedCardIndex = ref<number | null>(null);

// カード画像を拡大表示
const openImageModal = (card: Card, cardIndex: number) => {
  selectedCard.value = card;
  selectedCardIndex.value = cardIndex;
  selectedCardImage.value = getCardImageUrlSafe(card.id);
  isImageModalVisible.value = true;
};

// モーダルを閉じる
const closeImageModal = () => {
  isImageModalVisible.value = false;
  selectedCardImage.value = null;
  selectedCard.value = null;
  selectedCardIndex.value = null;
};

// カードナビゲーション
const handleCardNavigation = (direction: "previous" | "next") => {
  if (selectedCardIndex.value === null) return;

  let newIndex: number;
  if (direction === "previous") {
    newIndex = selectedCardIndex.value - 1;
  } else {
    newIndex = selectedCardIndex.value + 1;
  }

  if (newIndex >= 0 && newIndex < props.sortedAndFilteredCards.length) {
    const newCard = props.sortedAndFilteredCards[newIndex];
    selectedCard.value = newCard;
    selectedCardIndex.value = newIndex;
    selectedCardImage.value = getCardImageUrlSafe(newCard.id);
  }
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
const cardRefs = shallowReactive(new Map<string, HTMLElement>());
// カードIDごとの長押しstop関数を保存
const cardLongPressStops = shallowReactive(new Map<string, Function>());
// 前回のカードIDsを保存
const previousCardIds = ref(new Set<string>());

const setCardRef = (el: HTMLElement | null, cardId: string) => {
  if (el) {
    cardRefs.set(cardId, el);
  } else {
    cardRefs.delete(cardId);
  }
};

// 長押しハンドラーをバインド
const bindLongPress = (cardId: string, cardIndex: number) => {
  const el = cardRefs.get(cardId);
  if (!el) return;

  // 既存のstop関数があれば先にクリーンアップ
  const existingStop = cardLongPressStops.get(cardId);
  if (existingStop) {
    existingStop();
  }

  const card = props.sortedAndFilteredCards[cardIndex];
  const stop = onLongPress(el, () => openImageModal(card, cardIndex), {
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
    props.sortedAndFilteredCards.map((card) => card.id)
  );

  // 削除されたカードの長押しハンドラーをアンバインド
  for (const prevCardId of previousCardIds.value) {
    if (!currentCardIds.has(prevCardId)) {
      unbindLongPress(prevCardId);
    }
  }

  // 全てのカードの長押しハンドラーをバインド（新規追加と順序変更に対応）
  props.sortedAndFilteredCards.forEach((card, index) => {
    bindLongPress(card.id, index);
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
          class="w-4 h-4 text-blue-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
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
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.414A1 1 0 013 6.586V4z"
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

    <!-- カード画像拡大モーダル -->
    <CardImageModal
      :is-visible="isImageModalVisible"
      :image-src="selectedCardImage"
      :current-card="selectedCard"
      :card-index="selectedCardIndex"
      :total-cards="sortedAndFilteredCards.length"
      @close="closeImageModal"
      @navigate="handleCardNavigation"
    />
  </div>
</template>
