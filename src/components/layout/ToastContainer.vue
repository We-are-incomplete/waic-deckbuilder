<script setup lang="ts">
import type { ToastMessage } from "../../composables/useToast";

defineProps<{
  toasts: ToastMessage[];
}>();

const emit = defineEmits<{
  (e: "remove-toast", id: string): void;
}>();

const getToastClasses = (type: ToastMessage["type"]): string => {
  switch (type) {
    case "success":
      return "bg-green-500";
    case "error":
      return "bg-red-500";
    case "warning":
      return "bg-yellow-500";
    case "info":
    default:
      return "bg-blue-500";
  }
};
</script>

<template>
  <div class="fixed bottom-4 right-4 z-50 flex flex-col space-y-2">
    <TransitionGroup name="toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        :class="[
          'p-4 rounded-lg shadow-lg text-white flex items-center justify-between min-w-[250px]',
          getToastClasses(toast.type),
        ]"
        role="alert"
      >
        <span>{{ toast.message }}</span>
        <button
          @click="emit('remove-toast', toast.id)"
          class="ml-4 text-white hover:text-gray-100 focus:outline-none"
          aria-label="Close"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            ></path>
          </svg>
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.5s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}
.toast-leave-active {
  position: absolute;
}
</style>
