<template>
  <div
    v-if="isVisible"
    class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4"
    @click="closeModal"
  >
    <div class="max-w-[98vw] max-h-[98vh]" @click.stop>
      <!-- カード画像 -->
      <div
        ref="imageContainer"
        class="touch-pan-y"
        @touchstart="handleTouchStart"
        @touchmove="handleTouchMove"
        @touchend="handleTouchEnd"
      >
        <img
          v-if="imageSrc"
          :src="imageSrc"
          alt=""
          class="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          @error="handleImageError"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { handleImageError } from "../../utils/image";
import type { Card } from "../../types";

interface Props {
  isVisible: boolean;
  imageSrc: string | null;
  currentCard?: Card | null;
  cardIndex?: number | null;
  totalCards?: number | null;
}

interface Emits {
  (e: "close"): void;
  (e: "navigate", direction: "previous" | "next"): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const imageContainer = ref<HTMLElement | null>(null);

// スワイプ関連の状態
const touchStartX = ref<number | null>(null);
const touchStartY = ref<number | null>(null);
const minSwipeDistance = 50; // 最小スワイプ距離（px）

// ナビゲーション可能性を計算
const hasPreviousCard = computed(() => {
  if (props.cardIndex === null || props.cardIndex === undefined) return false;
  return props.cardIndex > 0;
});

const hasNextCard = computed(() => {
  if (
    props.cardIndex === null ||
    props.cardIndex === undefined ||
    props.totalCards === null ||
    props.totalCards === undefined
  )
    return false;
  return props.cardIndex < props.totalCards - 1;
});

// スワイプハンドラー
const handleTouchStart = (event: TouchEvent) => {
  if (event.touches.length === 1) {
    touchStartX.value = event.touches[0].clientX;
    touchStartY.value = event.touches[0].clientY;
  }
};

const handleTouchMove = (event: TouchEvent) => {
  // タッチムーブ中にデフォルトのスクロールを防ぐ
  event.preventDefault();
};

const handleTouchEnd = (event: TouchEvent) => {
  if (touchStartX.value === null || touchStartY.value === null) return;

  const touch = event.changedTouches[0];
  const deltaX = touch.clientX - touchStartX.value;
  const deltaY = touch.clientY - touchStartY.value;

  // 縦方向のスワイプが横方向よりも大きい場合は処理しない
  if (Math.abs(deltaY) > Math.abs(deltaX)) {
    touchStartX.value = null;
    touchStartY.value = null;
    return;
  }

  // 最小距離以上のスワイプかチェック
  if (Math.abs(deltaX) >= minSwipeDistance) {
    if (deltaX > 0 && hasPreviousCard.value) {
      // 右スワイプ - 前のカード
      navigateToPrevious();
    } else if (deltaX < 0 && hasNextCard.value) {
      // 左スワイプ - 次のカード
      navigateToNext();
    }
  }

  touchStartX.value = null;
  touchStartY.value = null;
};

// ナビゲーション関数
const navigateToPrevious = () => {
  if (hasPreviousCard.value) {
    emit("navigate", "previous");
  }
};

const navigateToNext = () => {
  if (hasNextCard.value) {
    emit("navigate", "next");
  }
};

const closeModal = () => {
  emit("close");
};
</script>
