<template>
  <div
    v-if="isVisible"
    class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-title"
    @click="closeModal"
    @keydown="handleKeydown"
  >
    <div
      ref="modalContent"
      class="max-w-[98vw] max-h-[98vh] outline-none"
      @click.stop
      tabindex="-1"
    >
      <!-- ローディング表示 -->
      <div
        v-if="isImageLoading && imageSrc"
        class="absolute inset-0 flex items-center justify-center"
      >
        <div
          class="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent"
        ></div>
      </div>

      <!-- カード画像 -->
      <div
        ref="imageContainer"
        class="touch-pan-y relative"
        @touchstart="handleTouchStart"
        @touchmove="handleTouchMove"
        @touchend="handleTouchEnd"
      >
        <img
          v-if="imageSrc"
          :src="imageSrc"
          :alt="imageAltText"
          class="max-w-full max-h-full object-contain shadow-2xl"
          @error="handleImageError"
          @load="isImageLoading = false"
        />
        <!-- 画面読み上げソフト用の見出し -->
        <h2 id="modal-title" class="sr-only">{{ imageAltText }}</h2>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
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
const modalContent = ref<HTMLElement | null>(null);
const isImageLoading = ref(false);
let previousFocusElement: HTMLElement | null = null;

// 画像の読み込み開始時
watch(
  () => props.imageSrc,
  (newSrc) => {
    if (newSrc) {
      isImageLoading.value = true;
    }
  }
);

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
  if (touchStartX.value === null || touchStartY.value === null) return;

  const touch = event.touches[0];
  const deltaX = touch.clientX - touchStartX.value;
  const deltaY = touch.clientY - touchStartY.value;

  // 水平方向の移動が縦方向より大きい場合のみpreventDefaultを呼び出す
  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    event.preventDefault();
  }
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
  restoreFocus();
  emit("close");
};

// アクセシビリティ関連の関数とコンピューテッドプロパティ
const imageAltText = computed(() => {
  if (!props.currentCard) {
    return "カードの詳細画像";
  }

  const cardInfo = props.currentCard.name;
  const positionInfo =
    props.cardIndex !== null &&
    props.cardIndex !== undefined &&
    props.totalCards
      ? ` (${props.cardIndex + 1}/${props.totalCards})`
      : "";

  return `${cardInfo}の詳細画像${positionInfo}`;
});

// キーボードイベントハンドラー
const handleKeydown = (event: KeyboardEvent) => {
  switch (event.key) {
    case "Escape":
      event.preventDefault();
      closeModal();
      break;
    case "ArrowLeft":
      event.preventDefault();
      if (hasPreviousCard.value) {
        navigateToPrevious();
      }
      break;
    case "ArrowRight":
      event.preventDefault();
      if (hasNextCard.value) {
        navigateToNext();
      }
      break;
  }
};

// フォーカス管理
const trapFocus = () => {
  if (modalContent.value) {
    modalContent.value.focus();
  }
};

const saveFocus = () => {
  previousFocusElement = document.activeElement as HTMLElement;
};

const restoreFocus = () => {
  if (previousFocusElement) {
    previousFocusElement.focus();
    previousFocusElement = null;
  }
};

// モーダル表示/非表示の監視
watch(
  () => props.isVisible,
  async (newVisible) => {
    if (newVisible) {
      saveFocus();
      await nextTick();
      trapFocus();
    } else {
      restoreFocus();
    }
  }
);

// ライフサイクルフック
onMounted(() => {
  if (props.isVisible) {
    saveFocus();
    trapFocus();
  }
});

onUnmounted(() => {
  restoreFocus();
});
</script>

<style scoped>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
