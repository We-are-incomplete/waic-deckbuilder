<script setup lang="ts">
import type { FilterCriteria, CardKind, CardType } from "../../types";

interface Props {
  isVisible: boolean;
  filterCriteria: FilterCriteria;
  allKinds: readonly CardKind[];
  allTypes: readonly CardType[];
  allTags: readonly string[];
}

interface Emits {
  (e: "close"): void;
  (e: "updateFilter", criteria: FilterCriteria): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const updateText = (text: string) => {
  emit("updateFilter", { ...props.filterCriteria, text });
};

const updateKind = (kind: CardKind[]) => {
  emit("updateFilter", { ...props.filterCriteria, kind });
};

const updateType = (type: CardType[]) => {
  emit("updateFilter", { ...props.filterCriteria, type });
};

const updateTags = (tags: string[]) => {
  emit("updateFilter", { ...props.filterCriteria, tags });
};
</script>

<template>
  <div
    v-if="isVisible"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    @click.self="emit('close')"
  >
    <div class="bg-gray-800 p-4 w-full h-full overflow-y-auto">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-bold">検索・絞り込み</h3>
        <button
          @click="emit('close')"
          class="text-gray-400 hover:text-white text-2xl"
        >
          ×
        </button>
      </div>

      <div class="mb-4">
        <label for="searchText" class="block text-sm font-medium mb-1"
          >テキスト検索 (名前, ID, タグ)</label
        >
        <input
          id="searchText"
          type="text"
          :value="filterCriteria.text"
          @input="updateText(($event.target as HTMLInputElement).value)"
          class="w-full px-3 py-2 text-sm sm:text-base rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring focus:border-blue-500"
          placeholder="カード名、ID、タグを入力"
        />
      </div>

      <div class="mb-4">
        <label class="block text-sm font-medium mb-2">種類で絞り込み</label>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
          <label v-for="kind in allKinds" :key="kind" class="flex items-center">
            <input
              type="checkbox"
              :value="kind"
              :checked="filterCriteria.kind.includes(kind)"
              @change="
                ($event.target as HTMLInputElement).checked
                  ? updateKind([...filterCriteria.kind, kind])
                  : updateKind(filterCriteria.kind.filter((k) => k !== kind))
              "
              class="form-checkbox h-4 w-4 min-h-5 min-w-5 text-blue-600 bg-gray-700 border-gray-600 rounded"
            />
            <span class="ml-2">{{ kind }}</span>
          </label>
        </div>
      </div>

      <div class="mb-4">
        <label class="block text-sm font-medium mb-2">タイプで絞り込み</label>
        <div
          class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 text-sm"
        >
          <label v-for="type in allTypes" :key="type" class="flex items-center">
            <input
              type="checkbox"
              :value="type"
              :checked="filterCriteria.type.includes(type)"
              @change="
                ($event.target as HTMLInputElement).checked
                  ? updateType([...filterCriteria.type, type])
                  : updateType(filterCriteria.type.filter((t) => t !== type))
              "
              class="form-checkbox h-4 w-4 min-h-5 min-w-5 text-blue-600 bg-gray-700 border-gray-600 rounded"
            />
            <span class="ml-2">{{ type }}</span>
          </label>
        </div>
      </div>

      <div class="mb-4">
        <label class="block text-sm font-medium mb-2">タグで絞り込み</label>
        <div
          class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 text-sm max-h-[40vh] overflow-y-auto pr-2"
        >
          <label v-for="tag in allTags" :key="tag" class="flex items-center">
            <input
              type="checkbox"
              :value="tag"
              :checked="filterCriteria.tags.includes(tag)"
              @change="
                ($event.target as HTMLInputElement).checked
                  ? updateTags([...filterCriteria.tags, tag])
                  : updateTags(filterCriteria.tags.filter((t) => t !== tag))
              "
              class="form-checkbox h-4 w-4 min-h-5 min-w-5 text-blue-600 bg-gray-700 border-gray-600 rounded"
            />
            <span class="ml-2">{{ tag }}</span>
          </label>
        </div>
      </div>
    </div>
  </div>
</template>
