<script setup lang="ts">
interface Props {
  isVisible: boolean;
  slashDeckCode: string; // スラッシュ区切りのデッキコード
  kcgDeckCode: string; // KCG形式のデッキコード
  importDeckCode: string;
  error?: string | null;
}

interface Emits {
  (e: "close"): void;
  (e: "updateImportCode", code: string): void;
  (e: "copySlashCode"): void; // スラッシュ区切りコードのコピーイベント
  (e: "copyKcgCode"): void; // KCGコードのコピーイベント
  (e: "importCode"): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();
</script>

<template>
  <div
    v-if="isVisible"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    @click.self="emit('close')"
  >
    <div class="bg-gray-800 rounded-lg p-4 sm:p-6 w-full max-w-md">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-bold">デッキコード</h3>
        <button
          @click="emit('close')"
          class="text-gray-400 hover:text-white text-2xl"
        >
          ×
        </button>
      </div>

      <!-- スラッシュ区切りデッキコード表示 -->
      <div class="mb-4">
        <h4 class="text-sm font-medium mb-2">スラッシュ区切りデッキコード</h4>
        <div
          class="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-2"
        >
          <input
            type="text"
            :value="slashDeckCode"
            readonly
            class="flex-grow px-3 py-2 text-sm rounded bg-gray-700 border border-gray-600"
          />
          <button
            @click="emit('copySlashCode')"
            class="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition duration-200 whitespace-nowrap min-w-24"
          >
            コピー
          </button>
        </div>
      </div>

      <!-- KCG形式デッキコード表示 -->
      <div class="mb-4">
        <h4 class="text-sm font-medium mb-2">KCG形式デッキコード</h4>
        <div
          class="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-2"
        >
          <input
            type="text"
            :value="kcgDeckCode"
            readonly
            class="flex-grow px-3 py-2 text-sm rounded bg-gray-700 border border-gray-600"
          />
          <button
            @click="emit('copyKcgCode')"
            class="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition duration-200 whitespace-nowrap min-w-24"
          >
            コピー
          </button>
        </div>
      </div>

      <div class="mb-4">
        <h4 class="text-sm font-medium mb-2">デッキコードをインポート</h4>
        <div
          class="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-2"
        >
          <input
            type="text"
            :value="importDeckCode"
            @input="
              emit(
                'updateImportCode',
                ($event.target as HTMLInputElement).value,
              )
            "
            @contextmenu.stop
            class="flex-grow px-3 py-2 text-sm sm:text-base rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring focus:border-blue-500"
            placeholder="デッキコードを入力"
          />
          <button
            @click="emit('importCode')"
            class="px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition duration-200 whitespace-nowrap min-w-24"
          >
            インポート
          </button>
        </div>
      </div>

      <!-- エラー表示 -->
      <div
        v-if="error"
        class="mb-4 p-3 bg-red-900/50 border border-red-700 rounded text-red-300 text-sm"
      >
        {{ error }}
      </div>
    </div>
  </div>
</template>
