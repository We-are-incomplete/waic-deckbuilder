import { defineStore } from "pinia";
import { ref } from "vue";
import { useCookies } from "@vueuse/integrations/useCookies";
import { useDeckCodeStore } from "./deckCode";

interface SavedDeck {
  name: string;
  code: string;
}

const isSavedDeck = (u: unknown): u is SavedDeck =>
  !!u &&
  typeof (u as any).name === "string" &&
  typeof (u as any).code === "string";

export const useDeckManagementStore = defineStore("deckManagement", () => {
  const cookies = useCookies(["savedDecks"]);
  const isDeckManagementModalOpen = ref(false);
  const savedDecks = ref<SavedDeck[]>([]);
  const deckCodeStore = useDeckCodeStore();

  // 初期化時にCookieからデッキを読み込む
  const loadDecksFromCookie = () => {
    try {
      const stored = cookies.get("savedDecks");
      if (stored === undefined || stored === null) {
        savedDecks.value = [];
        return;
      }
      if (!Array.isArray(stored)) {
        throw new Error("Stored decks is not an array.");
      }
      if (!stored.every(isSavedDeck)) {
        throw new Error("Invalid savedDecks element shape.");
      }
      savedDecks.value = stored as SavedDeck[];
    } catch (e) {
      console.error("Failed to load decks from cookie:", e);
      savedDecks.value = [];
    }
  };

  // デッキをCookieに保存する
  const saveDecksToCookie = () => {
    cookies.set("savedDecks", savedDecks.value, {
      expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    }); // 1年間有効
  };

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
    saveDecksToCookie();
  };

  // デッキを削除する
  const deleteDeck = (deckName: string) => {
    savedDecks.value = savedDecks.value.filter(
      (deck) => deck.name !== deckName,
    );
    saveDecksToCookie();
  };

  // デッキ管理モーダルを開く
  const openDeckManagementModal = () => {
    loadDecksFromCookie(); // モーダルを開く際に最新のデッキリストを読み込む
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
    loadDecksFromCookie,
  };
});
