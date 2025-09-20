<script setup lang="ts">
/*
 * 仕様:
 * - 目的: 検索テキスト/種類/タイプ/タグ/登場条件での絞り込みを行うモーダル
 * - 入出力: Props { isVisible }, Emits { close }
 * - 動作: テキストは 200ms デバウンス（maxWait: 1000ms）でストアへ反映
 *         ストア側のリセット/外部変更は UI へ同期
 * - 依存: Pinia filterStore / useFilterHelpers / @vueuse/core watchDebounced
 */
import { computed, ref, watch } from "vue";
import { watchDebounced } from "@vueuse/core";
import { useFilterStore } from "../../stores";
import { useFilterHelpers } from "../../composables/useFilterHelpers";
import type { CardKind, CardType } from "../../types";

// Props（最小限に削減）
interface Props {
  isVisible: boolean;
}

// Emits（UIイベントのみ）
interface Emits {
  (e: "close"): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

// フィルターストアの使用
const filterStore = useFilterStore();

// 計算プロパティでストアの状態を取得
const filterCriteria = computed(() => filterStore.filterCriteria);
const allKinds = computed(() => filterStore.allKinds);
const allTypes = computed(() => filterStore.allTypes);
const allTags = computed(() => filterStore.allTags);
const filterStats = computed(() => filterStore.filterStats);

// フィルター選択ヘルパー
const { isKindSelected, isTypeSelected, isTagSelected } =
  useFilterHelpers(filterCriteria);

// 入力のデバウンス制御
const inputText = ref(filterStore.filterCriteria.text);
watchDebounced(
  inputText,
  (text) => {
    // 無駄なディスパッチ防止
    if (text !== filterStore.filterCriteria.text) {
      filterStore.setTextFilter(text);
    }
  },
  { debounce: 200, maxWait: 1000 },
);

// ストア側変更（リセット等）をUIへ反映
watch(
  () => filterStore.filterCriteria.text,
  (text) => {
    if (text !== inputText.value) inputText.value = text;
  },
);

const toggleKind = (kind: CardKind) => {
  filterStore.toggleKindFilter(kind);
};

const toggleType = (type: CardType) => {
  filterStore.toggleTypeFilter(type);
};

const toggleTag = (tag: string) => {
  filterStore.toggleTagFilter(tag);
};

const resetFilters = () => {
  filterStore.resetFilterCriteria();
};
</script>

<template>
  <div
    v-if="isVisible"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    @click.self="emit('close')"
  >
    <div class="bg-gray-800 p-4 w-full h-full flex flex-col overflow-hidden">
      <!-- ヘッダー -->
      <div class="flex justify-between items-center mb-4 flex-shrink-0">
        <div>
          <h3 class="text-lg font-bold">検索・絞り込み</h3>
          <div class="text-sm text-gray-400 mt-1">
            {{ filterStats.filteredCount }} /
            {{ filterStats.totalCount }} 件表示
            <span class="text-blue-400">
              ({{ Math.round(filterStats.filterRate * 100) }}%)
            </span>
          </div>
        </div>
        <div class="flex gap-2">
          <!-- リセットボタン -->
          <button
            @click="resetFilters"
            :disabled="!filterStats.hasFilter"
            class="px-3 py-1 text-sm bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed rounded transition-colors"
            title="フィルターをリセット"
          >
            リセット
          </button>
          <!-- 閉じるボタン -->
          <button
            @click="emit('close')"
            class="text-gray-400 hover:text-white text-2xl w-8 h-8 flex items-center justify-center"
          >
            ×
          </button>
        </div>
      </div>

      <!-- 上部フィルター -->
      <div class="flex-shrink-0">
        <!-- テキスト検索 -->
        <div class="mb-4">
          <label for="searchText" class="block text-sm font-medium mb-1">
            テキスト検索 (名前, ID, タグ)
          </label>
          <div class="relative">
            <input
              id="searchText"
              type="text"
              v-model="inputText"
              class="w-full px-3 py-2 pr-10 text-sm sm:text-base rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring focus:border-blue-500"
              placeholder="カード名、ID、タグを入力"
            />
            <!-- 検索クリアボタン -->
            <button
              v-if="inputText"
              @click="inputText = ''"
              class="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
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
        </div>

        <!-- 種類フィルター -->
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">
            種類で絞り込み
            <span
              v-if="filterCriteria.kind.length > 0"
              class="text-blue-400 ml-1"
            >
              ({{ filterCriteria.kind.length }} 選択中)
            </span>
          </label>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
            <label
              v-for="kind in allKinds"
              :key="kind"
              class="flex items-center cursor-pointer hover:bg-gray-700 p-1 rounded transition-colors"
            >
              <input
                type="checkbox"
                :checked="isKindSelected(kind)"
                @change="toggleKind(kind)"
                class="form-checkbox h-4 w-4 min-h-5 min-w-5 text-blue-600 bg-gray-700 border-gray-600 rounded"
              />
              <span class="ml-2">{{ kind }}</span>
            </label>
          </div>
        </div>

        <!-- タイプフィルター -->
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">
            タイプで絞り込み
            <span
              v-if="filterCriteria.type.length > 0"
              class="text-blue-400 ml-1"
            >
              ({{ filterCriteria.type.length }} 選択中)
            </span>
          </label>
          <div
            class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 text-sm"
          >
            <label
              v-for="type in allTypes"
              :key="type"
              class="flex items-center cursor-pointer hover:bg-gray-700 p-1 rounded transition-colors"
            >
              <input
                type="checkbox"
                :checked="isTypeSelected(type)"
                @change="toggleType(type)"
                class="form-checkbox h-4 w-4 min-h-5 min-w-5 text-blue-600 bg-gray-700 border-gray-600 rounded"
              />
              <span class="ml-2">{{ type }}</span>
            </label>
          </div>
        </div>

        <!-- 登場条件フィルター -->
        <div class="mb-4">
          <label
            class="flex items-center cursor-pointer hover:bg-gray-700 p-1 rounded transition-colors"
          >
            <input
              type="checkbox"
              :checked="filterCriteria.hasEntryCondition"
              @change="filterStore.toggleEntryConditionFilter()"
              class="form-checkbox h-4 w-4 min-h-5 min-w-5 text-blue-600 bg-gray-700 border-gray-600 rounded"
            />
            <span class="ml-2 text-sm font-medium">【登場条件】で絞り込み</span>
          </label>
        </div>
      </div>

      <!-- タグフィルター（残りの領域を全て使用） -->
      <div class="min-h-0 flex-1 flex flex-col">
        <label class="block text-sm font-medium mb-2 flex-shrink-0">
          タグで絞り込み
          <span
            v-if="filterCriteria.tags.length > 0"
            class="text-blue-400 ml-1"
          >
            ({{ filterCriteria.tags.length }} 選択中)
          </span>
        </label>
        <div
          class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 text-sm overflow-y-auto pr-2 flex-1"
        >
          <label
            v-for="tag in allTags"
            :key="tag"
            class="flex items-center cursor-pointer hover:bg-gray-700 p-1 rounded transition-colors h-fit"
          >
            <input
              type="checkbox"
              :checked="isTagSelected(tag)"
              @change="toggleTag(tag)"
              class="form-checkbox h-4 w-4 min-h-5 min-w-5 text-blue-600 bg-gray-700 border-gray-600 rounded"
            />
            <span class="ml-2 text-xs">{{ tag }}</span>
          </label>
        </div>
      </div>
    </div>
  </div>
</template>
