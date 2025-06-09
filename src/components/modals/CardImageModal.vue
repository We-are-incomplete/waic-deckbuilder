<template>
  <div
    v-if="isVisible"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
    @click="closeModal"
  >
    <div class="max-w-[98vw] max-h-[98vh]" @click.stop>
      <img
        v-if="imageSrc"
        :src="imageSrc"
        alt=""
        class="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
        @error="handleImageError"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { handleImageError } from "../../utils/image";

interface Props {
  isVisible: boolean;
  imageSrc: string | null;
}

interface Emits {
  (e: "close"): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

const closeModal = () => {
  emit("close");
};
</script>
