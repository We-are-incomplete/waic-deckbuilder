/**
 * [spec] お気に入りカードの状態管理（Pinia）。
 * - 責務: お気に入りIDの永続化・参照・切替のみを提供（UIやフィルタは他層）。
 * - 設計: 関数型・最小API。副作用は useStorage に限定し分離。
 */
import { defineStore } from "pinia";
import { computed, readonly } from "vue";
import { useStorage } from "@vueuse/core";

const FAVORITE_CARDS_STORAGE_KEY = "waic-deckbuilder-favorite-cards" as const;

export const useFavoritesStore = defineStore("favorites", () => {
  // お気に入りID配列を永続化
  const favoriteIds = useStorage<string[]>(FAVORITE_CARDS_STORAGE_KEY, []);

  // Set 形式の参照（検索を高速化）
  const favoriteIdSet = computed<ReadonlySet<string>>(
    () => new Set(favoriteIds.value),
  );

  const isFavorite = (cardId: string): boolean =>
    favoriteIdSet.value.has(cardId);

  const toggleFavorite = (cardId: string): void => {
    const next = new Set(favoriteIdSet.value);
    if (next.has(cardId)) {
      next.delete(cardId);
    } else {
      next.add(cardId);
    }
    // 安定化のためIDでソート
    favoriteIds.value = [...next].sort();
  };

  return {
    favoriteIds: readonly(favoriteIds),
    favoriteIdSet,
    isFavorite,
    toggleFavorite,
  } as const;
});
