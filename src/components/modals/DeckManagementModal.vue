<script setup lang="ts">
import { ref, computed } from "vue";
import {
  useAppStore,
  useDeckCodeStore,
  useDeckManagementStore,
  useDeckStore,
} from "../../stores";

const deckManagementStore = useDeckManagementStore();
const deckStore = useDeckStore();
const deckCodeStore = useDeckCodeStore();
const appStore = useAppStore();

const newDeckName = ref(deckStore.deckName);

const isSaveMode = ref(true); // true: 保存モード, false: 読み込みモード

const currentDeckName = computed(() => deckStore.deckName);
const currentDeckCode = computed(() => deckCodeStore.kcgDeckCode);

const saveDeck = () => {
  if (newDeckName.value && currentDeckCode.value) {
    deckManagementStore.saveDeck(newDeckName.value, currentDeckCode.value);
    newDeckName.value = ""; // 保存後に入力欄をクリア
  }
};

const loadDeck = (deckName: string, deckCode: string) => {
  deckStore.setDeckName(deckName);
  deckCodeStore.setImportDeckCode(deckCode);
  appStore.importDeckFromCode();
  deckManagementStore.closeDeckManagementModal();
};

const deleteDeck = (deckName: string) => {
  if (confirm(`デッキ「${deckName}」を削除してもよろしいですか？`)) {
    deckManagementStore.deleteDeck(deckName);
  }
};

const saveDeckAsPng = async () => {
  if (appStore.deckSectionRef?.exportContainer) {
    appStore.exportStore.saveDeckAsPng(
      deckStore.deckName,
      appStore.deckSectionRef.exportContainer,
    );
    deckManagementStore.closeDeckManagementModal();
  }
};

const closeModal = () => {
  deckManagementStore.closeDeckManagementModal();
};
</script>

<template>
  <div
    v-if="deckManagementStore.isDeckManagementModalOpen"
    class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
    @click.self="closeModal"
  >
    <div
      class="bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md border border-slate-700 relative"
    >
      <button
        @click="closeModal"
        class="absolute top-3 right-3 text-slate-400 hover:text-slate-200 transition-colors"
      >
        <svg
          class="w-6 h-6"
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

      <h2 class="text-2xl font-bold text-white mb-4">デッキ管理</h2>

      <div class="flex mb-4">
        <button
          @click="isSaveMode = true"
          :class="{ 'bg-blue-600': isSaveMode, 'bg-slate-700': !isSaveMode }"
          class="flex-1 py-2 rounded-l-lg text-white font-medium transition-colors"
        >
          デッキ保存
        </button>
        <button
          @click="isSaveMode = false"
          :class="{ 'bg-blue-600': !isSaveMode, 'bg-slate-700': isSaveMode }"
          class="flex-1 py-2 rounded-r-lg text-white font-medium transition-colors"
        >
          デッキ読み込み・削除
        </button>
      </div>

      <div v-if="isSaveMode">
        <div class="mb-4">
          <label
            for="deckNameInput"
            class="block text-slate-300 text-sm font-bold mb-2"
            >現在のデッキ名:</label
          >
          <input
            id="deckNameInput"
            type="text"
            v-model="newDeckName"
            :placeholder="currentDeckName || 'デッキ名を入力'"
            class="shadow appearance-none border border-slate-600 rounded w-full py-2 px-3 text-slate-200 leading-tight focus:outline-none focus:shadow-outline bg-slate-700"
          />
        </div>
        <div class="mb-4">
          <label class="block text-slate-300 text-sm font-bold mb-2"
            >現在のデッキコード:</label
          >
          <textarea
            :value="currentDeckCode"
            readonly
            class="shadow appearance-none border border-slate-600 rounded w-full py-2 px-3 text-slate-200 leading-tight focus:outline-none focus:shadow-outline bg-slate-700 h-24 resize-none"
          ></textarea>
        </div>
        <button
          @click="saveDeck"
          :disabled="!newDeckName || !currentDeckCode"
          class="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          保存
        </button>
        <button
          @click="saveDeckAsPng"
          class="mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full"
        >
          デッキ画像を保存
        </button>
      </div>

      <div v-else>
        <div v-if="deckManagementStore.savedDecks.length > 0">
          <ul
            class="max-h-60 overflow-y-auto mb-4 border border-slate-700 rounded"
          >
            <li
              v-for="deck in deckManagementStore.savedDecks"
              :key="deck.name"
              class="flex justify-between items-center p-3 border-b border-slate-700 last:border-b-0 hover:bg-slate-700 transition-colors"
            >
              <span class="text-slate-200 font-medium">{{ deck.name }}</span>
              <div class="flex space-x-2">
                <button
                  @click="loadDeck(deck.name, deck.code)"
                  class="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1 px-2 rounded focus:outline-none focus:shadow-outline"
                >
                  読み込み
                </button>
                <button
                  @click="deleteDeck(deck.name)"
                  class="bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-1 px-2 rounded focus:outline-none focus:shadow-outline"
                >
                  削除
                </button>
              </div>
            </li>
          </ul>
        </div>
        <div v-else class="text-center text-slate-400 py-8">
          保存されたデッキはありません。
        </div>
      </div>
    </div>
  </div>
</template>
