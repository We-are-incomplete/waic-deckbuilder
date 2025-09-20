import { defineStore } from "pinia";
import { ref } from "vue";
import { useLocalStorage } from "@vueuse/core";
import * as v from "valibot";
import { useDeckCodeStore } from "./deckCode";

interface SavedDeck {
  name: string;
  code: string;
}

export const useDeckManagementStore = defineStore("deckManagement", () => {
  const isDeckManagementModalOpen = ref(false);
  const SavedDeckSchema = v.array(
    v.object({
      name: v.pipe(v.string(), v.trim(), v.nonEmpty()),
      code: v.pipe(v.string(), v.trim(), v.nonEmpty()),
    }),
  );
  const savedDecks = useLocalStorage<SavedDeck[]>("savedDecks", [], {
    serializer: {
      read: (raw: string): SavedDeck[] => {
        try {
          const data = JSON.parse(raw) as unknown;
          const result = v.safeParse(SavedDeckSchema, data);
          return result.success ? (result.output as SavedDeck[]) : [];
        } catch {
          return [];
        }
      },
      write: (value: SavedDeck[]) => JSON.stringify(value),
    },
    writeDefaults: true,
  });
  const deckCodeStore = useDeckCodeStore();

  // LocalStorage使用のためロード/保存関数は不要

  // デッキを保存する
  const saveDeck = (deckName: string, deckCode: string) => {
    const existingIndex = savedDecks.value.findIndex(
      (deck) => deck.name === deckName,
    );
    if (existingIndex !== -1) {
      // 既存のデッキを更新
      savedDecks.value[existingIndex] = { name: deckName, code: deckCode };
    } else {
      // 新しいデッキを追加
      savedDecks.value.push({ name: deckName, code: deckCode });
    }
    // useLocalStorage が自動保存
  };

  // デッキを削除する
  const deleteDeck = (deckName: string) => {
    savedDecks.value = savedDecks.value.filter(
      (deck) => deck.name !== deckName,
    );
    // useLocalStorage が自動保存
  };

  // デッキ管理モーダルを開く
  const openDeckManagementModal = () => {
    // LocalStorageはリアクティブに同期
    deckCodeStore.generateDeckCodes(); // デッキコードを更新
    isDeckManagementModalOpen.value = true;
  };

  // デッキ管理モーダルを閉じる
  const closeDeckManagementModal = () => {
    isDeckManagementModalOpen.value = false;
  };

  return {
    isDeckManagementModalOpen,
    savedDecks,
    saveDeck,
    deleteDeck,
    openDeckManagementModal,
    closeDeckManagementModal,
  };
});
