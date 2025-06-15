<script setup lang="ts">
import { ref } from "vue";
import type { DeckCard } from "../../types";
import { handleImageError, getCardImageUrlSafe } from "../../utils";

interface Props {
  deckName: string;
  deckCards: readonly DeckCard[];
  sortedDeckCards: readonly DeckCard[];
  isSaving: boolean;
}

defineProps<Props>();

const exportContainer = ref<HTMLElement | null>(null);

// エクスポート用のコンテナの設定
const EXPORT_CONTAINER_WIDTH = 3840; // エクスポート用のコンテナ幅
const EXPORT_CONTAINER_HEIGHT = 2160; // エクスポート用のコンテナ高さ
const EXPORT_CONTAINER_PADDING = "298px 242px 297px 241px"; // エクスポート用のコンテナのパディング

// カード幅計算に使用する定数
const CARD_COUNT_THRESHOLD = 30;
const CARDS_PER_ROW_SMALL = 10;
const CARDS_PER_ROW_LARGE = 15;
const GRID_GAP = 13; // グリッドの間隔
const MARGIN_SMALL = GRID_GAP * (CARDS_PER_ROW_SMALL - 1);
const MARGIN_LARGE = GRID_GAP * (CARDS_PER_ROW_LARGE - 1);

/**
 * カード枚数に基づいてカード幅を計算
 */
const calculateCardWidth = (cardCount: number): string => {
  if (cardCount <= CARD_COUNT_THRESHOLD) {
    return `calc((100% - ${MARGIN_SMALL}px) / ${CARDS_PER_ROW_SMALL})`;
  }
  return `calc((100% - ${MARGIN_LARGE}px) / ${CARDS_PER_ROW_LARGE})`;
};

/**
 * カード枚数に基づいて背景画像のURLを返す
 */
const getBackgroundImageUrl = (cardCount: number): string => {
  if (cardCount <= CARD_COUNT_THRESHOLD) {
    return `${import.meta.env.BASE_URL}sheet.avif`;
  } else {
    return `${import.meta.env.BASE_URL}sheet_nogrid.avif`;
  }
};

// 親コンポーネントからrefを取得できるように公開
defineExpose({ exportContainer });
</script>

<template>
  <!-- エクスポート用の隠されたコンテナ -->
  <div
    ref="exportContainer"
    v-show="isSaving"
    class="fixed pointer-events-none -left-[9999px] top-0 -z-10"
    :style="{
      width: `${EXPORT_CONTAINER_WIDTH}px`,
      height: `${EXPORT_CONTAINER_HEIGHT}px`,
      padding: EXPORT_CONTAINER_PADDING,
      backgroundImage: `url(${getBackgroundImageUrl(deckCards.length)})`,
    }"
  >
    <!-- デッキ名 -->
    <div
      class="absolute top-[120px] left-1/2 -translate-x-1/2 z-10 w-full text-center leading-tight font-exdeck text-[128px] font-bold text-[#353100]"
    >
      「{{ deckName }}」
    </div>

    <!-- カードグリッド -->
    <div
      class="flex flex-wrap w-full h-full justify-start items-center content-center gap-x-[13px] gap-y-[5px]"
    >
      <div
        v-for="item in sortedDeckCards"
        :key="`export-${item.card.id}`"
        class="relative"
        :style="{
          width: calculateCardWidth(deckCards.length),
        }"
      >
        <!-- カード画像 -->
        <img
          :src="getCardImageUrlSafe(item.card.id)"
          :alt="item.card.name"
          class="w-full h-full object-cover rounded-lg"
          crossorigin="anonymous"
          @error="handleImageError"
        />

        <!-- カウントバッジ -->
        <div
          class="mt-[12px] h-[54px] w-full text-center font-exdeck text-[36px] font-bold text-[#353100]"
        >
          {{ item.count }}
        </div>
      </div>
    </div>
  </div>
</template>
