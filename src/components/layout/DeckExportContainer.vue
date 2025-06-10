<script setup lang="ts">
import { ref } from "vue";
import type { DeckCard } from "../../types";
import { EXPORT_CONFIG } from "../../constants/export";
import { handleImageError } from "../../utils/image";
import { getCardImageUrlSafe } from "../../utils/imageHelpers";

interface Props {
  deckName: string;
  deckCards: readonly DeckCard[];
  sortedDeckCards: readonly DeckCard[];
  isSaving: boolean;
}

defineProps<Props>();

const exportContainer = ref<HTMLElement | null>(null);

// カード幅計算に使用する定数
const CARD_COUNT_THRESHOLD_SMALL = 30;
const CARD_COUNT_THRESHOLD_MEDIUM = 48;
const CARDS_PER_ROW_SMALL = 10;
const CARDS_PER_ROW_MEDIUM = 12;
const CARDS_PER_ROW_LARGE = 15;
const MARGIN_SMALL = 36;
const MARGIN_MEDIUM = 44;
const MARGIN_LARGE = 56;

/**
 * カード枚数に基づいてカード幅を計算
 */
const calculateCardWidth = (cardCount: number): string => {
  if (cardCount <= CARD_COUNT_THRESHOLD_SMALL) {
    return `calc((100% - ${MARGIN_SMALL}px) / ${CARDS_PER_ROW_SMALL})`;
  }
  if (cardCount <= CARD_COUNT_THRESHOLD_MEDIUM) {
    return `calc((100% - ${MARGIN_MEDIUM}px) / ${CARDS_PER_ROW_MEDIUM})`;
  }
  return `calc((100% - ${MARGIN_LARGE}px) / ${CARDS_PER_ROW_LARGE})`;
};

// 親コンポーネントからrefを取得できるように公開
defineExpose({ exportContainer });
</script>

<template>
  <!-- エクスポート用の隠されたコンテナ -->
  <div
    ref="exportContainer"
    v-show="isSaving"
    class="fixed pointer-events-none"
    style="left: -9999px; top: 0; z-index: -1"
    :style="{
      width: `${EXPORT_CONFIG.canvas.width}px`,
      height: `${EXPORT_CONFIG.canvas.height}px`,
      backgroundColor: EXPORT_CONFIG.canvas.backgroundColor,
      padding: EXPORT_CONFIG.canvas.padding,
    }"
  >
    <!-- デッキ名 -->
    <div
      class="absolute left-1/2 -translate-x-1/2 w-full text-center"
      :style="{
        fontSize: EXPORT_CONFIG.deckName.fontSize,
        fontWeight: EXPORT_CONFIG.deckName.fontWeight,
        color: EXPORT_CONFIG.deckName.color,
        fontFamily: EXPORT_CONFIG.deckName.fontFamily,
      }"
    >
      {{ deckName }}
    </div>

    <!-- カードグリッド -->
    <div
      class="flex flex-wrap w-full h-full justify-start items-center content-center"
      :style="{
        gap: EXPORT_CONFIG.grid.gap,
      }"
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
          class="w-full h-full object-cover"
          :style="{
            borderRadius: EXPORT_CONFIG.card.borderRadius,
          }"
          crossorigin="anonymous"
          @error="handleImageError"
        />

        <!-- カウントバッジ -->
        <div
          class="absolute bottom-[5px] right-[5px] font-bold"
          :style="{
            backgroundColor: EXPORT_CONFIG.badge.backgroundColor,
            color: EXPORT_CONFIG.badge.color,
            padding: EXPORT_CONFIG.badge.padding,
            borderRadius: EXPORT_CONFIG.badge.borderRadius,
            fontSize: EXPORT_CONFIG.badge.fontSize,
          }"
        >
          ×{{ item.count }}
        </div>
      </div>
    </div>
  </div>
</template>
