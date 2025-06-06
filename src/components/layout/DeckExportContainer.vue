<script setup lang="ts">
import { ref } from "vue";
import type { DeckCard } from "../../types";
import { EXPORT_CONFIG } from "../../constants/export";
import { getCardImageUrl, handleImageError } from "../../utils/image";
import { calculateCardWidth } from "../../utils/export";

interface Props {
  deckName: string;
  deckCards: readonly DeckCard[];
  sortedDeckCards: readonly DeckCard[];
  isSaving: boolean;
}

defineProps<Props>();

const exportContainer = ref<HTMLElement | null>(null);

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
      :style="{
        position: 'absolute',
        fontSize: EXPORT_CONFIG.deckName.fontSize,
        fontWeight: EXPORT_CONFIG.deckName.fontWeight,
        color: EXPORT_CONFIG.deckName.color,
        fontFamily: EXPORT_CONFIG.deckName.fontFamily,
        textAlign: 'center',
        width: '100%',
      }"
    >
      {{ deckName }}
    </div>

    <!-- カードグリッド -->
    <div
      :style="{
        display: 'flex',
        flexWrap: 'wrap',
        gap: EXPORT_CONFIG.grid.gap,
        width: '100%',
        height: '100%',
        justifyContent: 'flex-start',
        alignItems: 'center',
        alignContent: 'center',
      }"
    >
      <div
        v-for="item in sortedDeckCards"
        :key="`export-${item.card.id}`"
        :style="{
          position: 'relative',
          width: calculateCardWidth(deckCards.length),
        }"
      >
        <!-- カード画像 -->
        <img
          :src="getCardImageUrl(item.card.id)"
          :alt="item.card.name"
          :style="{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: EXPORT_CONFIG.card.borderRadius,
          }"
          crossorigin="anonymous"
          @error="handleImageError"
        />

        <!-- カウントバッジ -->
        <div
          :style="{
            position: 'absolute',
            bottom: '5px',
            right: '5px',
            backgroundColor: EXPORT_CONFIG.badge.backgroundColor,
            color: EXPORT_CONFIG.badge.color,
            padding: EXPORT_CONFIG.badge.padding,
            borderRadius: EXPORT_CONFIG.badge.borderRadius,
            fontSize: EXPORT_CONFIG.badge.fontSize,
            fontWeight: 'bold',
          }"
        >
          ×{{ item.count }}
        </div>
      </div>
    </div>
  </div>
</template>
