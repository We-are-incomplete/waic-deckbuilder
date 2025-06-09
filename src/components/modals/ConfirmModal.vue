<template>
  <div
    v-if="isVisible"
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000] animate-fadeIn"
    @click="onBackdropClick"
    @keydown.esc="onCancel"
    tabindex="0"
    role="dialog"
    aria-modal="true"
    :aria-label="title"
  >
    <div
      class="bg-gray-800 rounded-lg shadow-lg max-w-md w-[90%] max-h-[90vh] overflow-hidden animate-slideIn"
      @click.stop
    >
      <div
        class="flex justify-between items-center p-4 sm:px-6 border-b border-gray-600"
      >
        <h2 class="m-0 text-xl font-semibold text-white">{{ title }}</h2>
        <button
          class="bg-transparent border-none text-2xl text-gray-400 cursor-pointer p-0 w-8 h-8 flex items-center justify-center rounded transition-all duration-200 ease-in-out hover:bg-gray-700 hover:text-white"
          @click="onCancel"
          aria-label="閉じる"
        >
          ×
        </button>
      </div>
      <div class="p-6">
        <p class="m-0 text-gray-300 leading-relaxed">{{ message }}</p>
      </div>
      <div
        class="flex justify-end gap-3 p-4 sm:px-6 border-t border-gray-600 bg-gray-700 sm:flex-col"
      >
        <button
          class="px-4 py-2 rounded-md border font-medium cursor-pointer transition-all duration-200 ease-in-out text-sm bg-gray-600 border-gray-500 text-gray-300 hover:bg-gray-500 hover:border-gray-400 disabled:opacity-60 disabled:cursor-not-allowed sm:w-full"
          @click="onCancel"
          :disabled="loading"
        >
          キャンセル
        </button>
        <button
          class="px-4 py-2 rounded-md border font-medium cursor-pointer transition-all duration-200 ease-in-out text-sm bg-blue-600 border-blue-600 text-white hover:bg-blue-700 hover:border-blue-700 disabled:opacity-60 disabled:cursor-not-allowed sm:w-full"
          @click="onConfirm"
          :disabled="loading"
        >
          {{ loading ? "処理中..." : confirmText }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";

interface Props {
  isVisible: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  loading?: boolean;
}

interface Emits {
  (e: "confirm"): void;
  (e: "cancel"): void;
}

const props = withDefaults(defineProps<Props>(), {
  title: "確認",
  confirmText: "OK",
  loading: false,
});

const emit = defineEmits<Emits>();

const onConfirm = () => {
  if (!props.loading) {
    emit("confirm");
  }
};

const onCancel = () => {
  if (!props.loading) {
    emit("cancel");
  }
};

const onBackdropClick = () => {
  if (!props.loading) {
    emit("cancel");
  }
};

// ESCキーでモーダルを閉じる
const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === "Escape" && props.isVisible && !props.loading) {
    emit("cancel");
  }
};

onMounted(() => {
  document.addEventListener("keydown", handleKeyDown);
});

onUnmounted(() => {
  document.removeEventListener("keydown", handleKeyDown);
});
</script>

<style scoped>
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideIn {
  from {
    transform: translateY(-20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>
