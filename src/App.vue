<script setup>
import { ref, computed, onMounted, watch } from "vue";
import html2canvas from "html2canvas-pro";

// ===================================
// 状態管理 - State Management
// ===================================

// カードデータ関連
const availableCards = ref([]); // 全てのカードデータ
const deckCards = ref([]); // デッキに入っているカード { card: {}, count: N } の形式
const deckName = ref("新しいデッキ"); // デッキ名
const deckCode = ref(""); // デッキコード
const importDeckCode = ref(""); // インポート用デッキコード

// UI状態管理
const isLoading = ref(true); // データ読み込み中フラグ
const error = ref(null); // エラーメッセージ
const isSaving = ref(false); // 保存中状態
const isGeneratingCode = ref(false); // コード生成中状態
const showDeckCodeModal = ref(false); // デッキコードモーダル表示状態
const isFilterModalOpen = ref(false); // フィルターモーダル表示状態

// フィルター・検索関連
const filterCriteria = ref({
  text: "",
  kind: [],
  type: [],
  tags: [],
});

// ===================================
// 定数定義 - Constants
// ===================================

const allKinds = ["Artist", "Song", "Magic", "Direction"];
const allTypes = ["赤", "青", "黄", "白", "黒", "全", "即時", "装備", "設置"];

// 優先タグのリスト（重要なタグを先頭に表示）
const priorityTags = [
  "V.W.P",
  "花譜",
  "理芽",
  "春猿火",
  "ヰ世界情緒",
  "幸祜",
  "CIEL",
  "V.I.P",
  "可不",
  "裏命",
  "羽累",
  "星界",
  "狐子",
  "VALIS",
  "CHINO",
  "MYU",
  "NEFFY",
  "RARA",
  "VITTE",
  "Albemuth",
  "明透",
  "心世紀",
  "佳鏡院",
  "御莉姫",
  "硝子宮",
  "罪十罰",
  "美古途",
  "夕凪機",
  "氷夏至",
  "カフ",
  "リメ",
  "ハル",
  "セカイ",
  "ココ",
  "化歩",
  "狸眼",
  "派流",
  "世界",
  "此処",
  "詩得",
  "瓦利斯",
  "阿栖&亜留",
];

// ===================================
// ユーティリティ関数 - Utility Functions
// ===================================

// デバウンス関数
const debounce = (fn, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

// 自然順ソート関数 (ID用: AA-1, AA-2, ..., AA-10)
const naturalSort = (a, b) => {
  const regex = /(\d+)|(\D+)/g;
  const tokensA = a.match(regex);
  const tokensB = b.match(regex);

  if (!tokensA || !tokensB) return a.localeCompare(b);

  for (let i = 0; i < Math.min(tokensA.length, tokensB.length); i++) {
    const tokenA = tokensA[i];
    const tokenB = tokensB[i];
    const numA = parseInt(tokenA, 10);
    const numB = parseInt(tokenB, 10);

    if (!isNaN(numA) && !isNaN(numB)) {
      if (numA !== numB) return numA - numB;
    } else {
      const charCodeA = tokenA.charCodeAt(0);
      const charCodeB = tokenB.charCodeAt(0);
      const isUpperA = charCodeA >= 65 && charCodeA <= 90;
      const isUpperB = charCodeB >= 65 && charCodeB <= 90;

      if (isUpperA !== isUpperB) {
        return isUpperA ? -1 : 1;
      }
      if (tokenA !== tokenB) return tokenA.localeCompare(tokenB);
    }
  }

  return tokensA.length - tokensB.length;
};

// 種類ソート関数
const kindSort = (a, b) => {
  const indexA = allKinds.indexOf(a.kind);
  const indexB = allKinds.indexOf(b.kind);
  return indexA - indexB;
};

// タイプソート関数
const typeSort = (a, b) => {
  const getEarliestTypeIndex = (cardTypes) => {
    if (!cardTypes) return allTypes.length;
    const types = Array.isArray(cardTypes) ? cardTypes : [cardTypes];
    let minIndex = allTypes.length;
    types.forEach((type) => {
      const index = allTypes.indexOf(type);
      if (index !== -1 && index < minIndex) {
        minIndex = index;
      }
    });
    return minIndex;
  };

  const indexA = getEarliestTypeIndex(a.type);
  const indexB = getEarliestTypeIndex(b.type);
  return indexA - indexB;
};

// フィルター処理関数
const filterCards = (cards, criteria) => {
  const textLower = criteria.text.toLowerCase();
  const kindSet = new Set(criteria.kind);
  const typeSet = new Set(criteria.type);
  const tagSet = new Set(criteria.tags);

  return cards.filter((card) => {
    // テキスト検索
    if (
      textLower &&
      !(
        card.name.toLowerCase().includes(textLower) ||
        card.id.toLowerCase().includes(textLower) ||
        (Array.isArray(card.tags) &&
          card.tags.some((tag) => tag.toLowerCase().includes(textLower)))
      )
    ) {
      return false;
    }

    // 種類フィルター
    if (kindSet.size > 0 && !kindSet.has(card.kind)) {
      return false;
    }

    // タイプフィルター
    if (typeSet.size > 0) {
      const cardTypes = Array.isArray(card.type) ? card.type : [card.type];
      if (!cardTypes.some((type) => typeSet.has(type))) {
        return false;
      }
    }

    // タグフィルター
    if (
      tagSet.size > 0 &&
      !(Array.isArray(card.tags) && card.tags.some((tag) => tagSet.has(tag)))
    ) {
      return false;
    }

    return true;
  });
};

// ===================================
// 画像関連 - Image Management
// ===================================

const cardCache = new Map();

// 画像パス取得
const getCardImageUrl = (cardId) => {
  return `/waic-deckbuilder/cards/${cardId}.avif`;
};

// 画像読み込みエラー処理
const handleImageError = (event) => {
  event.target.src = "/waic-deckbuilder/placeholder.avif";
  event.target.onerror = null;
};

// 画像のプリロード最適化
const preloadImages = (cards) => {
  const batchSize = 10;
  const loadBatch = (startIndex) => {
    const endIndex = Math.min(startIndex + batchSize, cards.length);
    const batch = cards.slice(startIndex, endIndex);

    batch.forEach((card) => {
      if (!cardCache.has(card.id)) {
        const img = new Image();
        img.src = getCardImageUrl(card.id);
        cardCache.set(card.id, img);
      }
    });

    if (endIndex < cards.length) {
      setTimeout(() => loadBatch(endIndex), 100);
    }
  };

  loadBatch(0);
};

// ===================================
// Computed Properties
// ===================================

// 全タグリスト（優先タグを先頭に配置）
const allTags = computed(() => {
  const tags = new Set();
  availableCards.value.forEach((card) => {
    if (Array.isArray(card.tags)) {
      card.tags.forEach((tag) => tags.add(tag));
    }
  });

  const priorityTagSet = new Set(priorityTags);
  const otherTags = Array.from(tags)
    .filter((tag) => !priorityTagSet.has(tag))
    .sort();

  return [...priorityTags.filter((tag) => tags.has(tag)), ...otherTags];
});

// ソート・フィルター済みカード一覧
const sortedAndFilteredAvailableCards = computed(() => {
  const filtered = filterCards(availableCards.value, filterCriteria.value);
  const sorted = [...filtered];

  sorted.sort((a, b) => {
    const kindComparison = kindSort(a, b);
    if (kindComparison !== 0) return kindComparison;

    const typeComparison = typeSort(a, b);
    if (typeComparison !== 0) return typeComparison;

    return naturalSort(a.id, b.id);
  });

  return sorted;
});

// ソート済みデッキカード
const sortedDeckCards = computed(() => {
  const sorted = [...deckCards.value];

  sorted.sort((a, b) => {
    const cardA = a.card;
    const cardB = b.card;

    const kindComparison = kindSort({ kind: cardA.kind }, { kind: cardB.kind });
    if (kindComparison !== 0) return kindComparison;

    const typeComparison = typeSort({ type: cardA.type }, { type: cardB.type });
    if (typeComparison !== 0) return typeComparison;

    return naturalSort(cardA.id, cardB.id);
  });

  return sorted;
});

// デッキの合計枚数
const totalDeckCards = computed(() => {
  return deckCards.value.reduce((sum, item) => sum + item.count, 0);
});

// ===================================
// データ操作 - Data Management
// ===================================

// カードデータ読み込み
const loadCards = async () => {
  isLoading.value = true;
  error.value = null;

  try {
    const response = await fetch("/waic-deckbuilder/cards.json");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    availableCards.value = data;
    preloadImages(data);
  } catch (e) {
    console.error("カードデータの読み込みに失敗しました:", e);
    error.value =
      "カードデータの読み込みに失敗しました。ページを再読み込みしてください。";
  } finally {
    isLoading.value = false;
  }
};

// ローカルストレージ操作
const saveDeckToLocalStorage = (deck) => {
  try {
    const simpleDeck = deck.map((item) => ({
      id: item.card.id,
      count: item.count,
    }));
    localStorage.setItem("deckCards_k", JSON.stringify(simpleDeck));
  } catch (e) {
    handleError(e, "デッキの保存に失敗しました");
  }
};

const loadDeckFromLocalStorage = () => {
  try {
    const savedDeck = localStorage.getItem("deckCards_k");
    const savedName = localStorage.getItem("deckName_k");

    if (savedName) {
      deckName.value = savedName;
    }

    if (savedDeck) {
      const simpleDeck = JSON.parse(savedDeck);
      deckCards.value = simpleDeck
        .map((item) => {
          const card = availableCards.value.find((c) => c.id === item.id);
          return card ? { card: card, count: item.count } : null;
        })
        .filter((item) => item !== null);
    }
  } catch (e) {
    handleError(e, "保存されたデッキの読み込みに失敗しました");
    localStorage.removeItem("deckCards_k");
    localStorage.removeItem("deckName_k");
  }
};

// ===================================
// UI操作 - UI Interactions
// ===================================

// エラーハンドリング
const handleError = (error, message) => {
  console.error(message, error);
};

// フィルターモーダル操作
const openFilterModal = () => {
  isFilterModalOpen.value = true;
};

const closeFilterModal = () => {
  isFilterModalOpen.value = false;
};

// ===================================
// デッキ操作 - Deck Management
// ===================================

// カードをデッキに追加
const addCardToDeck = (card) => {
  if (totalDeckCards.value >= 60) {
    return;
  }

  const existingCardIndex = deckCards.value.findIndex(
    (item) => item.card.id === card.id
  );

  if (existingCardIndex > -1) {
    if (deckCards.value[existingCardIndex].count < 4) {
      deckCards.value[existingCardIndex].count++;
    }
  } else {
    deckCards.value.push({ card: card, count: 1 });
  }
};

// カード枚数を増やす
const incrementCardCount = (cardId) => {
  if (totalDeckCards.value >= 60) {
    return;
  }
  const item = deckCards.value.find((item) => item.card.id === cardId);
  if (item && item.count < 4) {
    item.count++;
  }
};

// カード枚数を減らす
const decrementCardCount = (cardId) => {
  const item = deckCards.value.find((item) => item.card.id === cardId);
  if (item && item.count > 1) {
    item.count--;
  } else if (item && item.count === 1) {
    removeCardFromDeck(cardId);
  }
};

// カードをデッキから削除
const removeCardFromDeck = (cardId) => {
  deckCards.value = deckCards.value.filter((item) => item.card.id !== cardId);
};

// デッキをリセット
const resetDeck = () => {
  if (confirm("デッキ内容を全てリセットしてもよろしいですか？")) {
    deckCards.value = [];
    deckName.value = "新しいデッキ";
    localStorage.removeItem("deckCards_k");
    localStorage.removeItem("deckName_k");
  }
};

// ===================================
// デッキコード機能 - Deck Code Management
// ===================================

// デッキコードのエンコード
const encodeDeckCode = (deck) => {
  const cardIds = deck.flatMap((item) => Array(item.count).fill(item.card.id));
  return cardIds.join("/");
};

// デッキコードのデコード
const decodeDeckCode = (code) => {
  const cardIds = code.split("/");
  const cardCounts = new Map();

  cardIds.forEach((id) => {
    cardCounts.set(id, (cardCounts.get(id) || 0) + 1);
  });

  const cards = [];
  for (const [id, count] of cardCounts) {
    const card = availableCards.value.find((c) => c.id === id);
    if (card) {
      cards.push({ card, count });
    }
  }

  return cards;
};

// デッキコード生成・表示
const generateAndShowDeckCode = () => {
  isGeneratingCode.value = true;
  try {
    deckCode.value = encodeDeckCode(deckCards.value);
    showDeckCodeModal.value = true;
  } catch (e) {
    console.error("デッキコードの生成に失敗しました:", e);
  } finally {
    isGeneratingCode.value = false;
  }
};

// デッキコードをコピー
const copyDeckCode = () => {
  navigator.clipboard
    .writeText(deckCode.value)
    .then(() => {
      console.log("デッキコードをコピーしました");
    })
    .catch(() => {
      console.error("デッキコードのコピーに失敗しました");
    });
};

// デッキコードからインポート
const importDeckFromCode = () => {
  try {
    const importedCards = decodeDeckCode(importDeckCode.value);
    if (importedCards.length > 0) {
      deckCards.value = importedCards;
      importDeckCode.value = "";
      showDeckCodeModal.value = false;
    } else {
      console.warn("有効なカードが見つかりませんでした");
    }
  } catch (e) {
    console.error("デッキコードの復元に失敗しました:", e);
  }
};

// ===================================
// 画像保存機能 - Image Export
// ===================================

const saveDeckAsPng = async () => {
  isSaving.value = true;

  try {
    const container = document.createElement("div");
    container.style.width = "1920px";
    container.style.height = "1080px";
    container.style.backgroundColor = "#030712";
    container.style.padding = "0 10px 10px 10px";
    container.style.position = "absolute";
    container.style.left = "-9999px";
    document.body.appendChild(container);

    // デッキ名表示
    const deckNameElement = document.createElement("div");
    deckNameElement.style.position = "absolute";
    deckNameElement.style.fontSize = "80px";
    deckNameElement.style.fontWeight = "bold";
    deckNameElement.style.color = "#f9fafb";
    deckNameElement.style.fontFamily = "serif";
    deckNameElement.style.textAlign = "center";
    deckNameElement.style.width = "100%";
    deckNameElement.textContent = deckName.value;
    container.appendChild(deckNameElement);

    // カードグリッド作成
    const grid = document.createElement("div");
    grid.style.display = "flex";
    grid.style.flexWrap = "wrap";
    grid.style.gap = "4px";
    grid.style.width = "100%";
    grid.style.height = "100%";
    grid.style.justifyContent = "flex-start";
    grid.style.alignItems = "center";
    grid.style.alignContent = "center";
    container.appendChild(grid);

    // カード追加
    const cardPromises = sortedDeckCards.value.map(async (item) => {
      const cardContainer = document.createElement("div");
      cardContainer.style.position = "relative";

      const cardWidth =
        sortedDeckCards.value.length <= 30
          ? "calc((100% - 36px) / 10)"
          : sortedDeckCards.value.length <= 48
          ? "calc((100% - 44px) / 12)"
          : "calc((100% - 56px) / 15)";
      cardContainer.style.width = cardWidth;

      const img = document.createElement("img");
      img.src = getCardImageUrl(item.card.id);
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = "cover";
      img.style.borderRadius = "8px";

      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });

      cardContainer.appendChild(img);

      const countBadge = document.createElement("div");
      countBadge.style.position = "absolute";
      countBadge.style.bottom = "5px";
      countBadge.style.right = "5px";
      countBadge.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
      countBadge.style.color = "white";
      countBadge.style.padding = "2px 12px";
      countBadge.style.borderRadius = "12px";
      countBadge.style.fontSize = "32px";
      countBadge.style.fontWeight = "bold";
      countBadge.textContent = `×${item.count}`;
      cardContainer.appendChild(countBadge);

      grid.appendChild(cardContainer);
    });

    await Promise.all(cardPromises);

    const canvas = await html2canvas(container, {
      scale: 1,
      width: 1920,
      height: 1080,
      useCORS: true,
      logging: false,
      allowTaint: true,
      backgroundColor: "#1F2937",
    });

    document.body.removeChild(container);

    const link = document.createElement("a");
    const timestamp = new Date()
      .toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })
      .replace(/\//g, "-");
    const filename = `${deckName.value || "デッキ"}_${timestamp}.png`;
    link.download = filename;
    link.href = canvas.toDataURL("image/png");
    link.click();
    console.log(`デッキ画像を保存しました: ${filename}`);
  } catch (e) {
    handleError(e, "デッキ画像の保存に失敗しました");
  } finally {
    isSaving.value = false;
  }
};

// ===================================
// ライフサイクル・ウォッチャー - Lifecycle & Watchers
// ===================================

// コンポーネントマウント時の処理
onMounted(() => {
  loadCards();
  loadDeckFromLocalStorage();
});

// デッキ変更時のローカルストレージ保存
watch(
  deckCards,
  (newDeck) => {
    saveDeckToLocalStorage(newDeck);
  },
  { deep: true }
);

watch(deckName, (newName) => {
  localStorage.setItem("deckName_k", newName);
});
</script>

<template>
  <div
    class="flex flex-col h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100 font-sans relative overflow-hidden"
  >
    <!-- 背景アニメーション -->
    <div class="absolute inset-0 overflow-hidden pointer-events-none">
      <div
        class="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-br from-blue-500/5 to-purple-600/5 rounded-full blur-3xl animate-pulse"
      ></div>
      <div
        class="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-to-tr from-emerald-500/5 to-cyan-500/5 rounded-full blur-3xl animate-pulse"
        style="animation-delay: 2s"
      ></div>
    </div>

    <!-- デッキセクション -->
    <div
      class="flex flex-col flex-grow-0 h-1/2 p-2 sm:p-4 border-b border-slate-700/50 overflow-hidden relative z-10 backdrop-blur-sm"
    >
      <!-- デッキ名入力 (モバイル優先) -->
      <div class="mb-3 px-2">
        <div class="flex items-center w-full">
          <label
            for="deckName"
            class="mr-2 sm:mr-3 text-xs sm:text-sm font-medium text-slate-300 whitespace-nowrap"
            >デッキ名:</label
          >
          <input
            id="deckName"
            type="text"
            v-model="deckName"
            class="flex-grow px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg bg-slate-800/80 border border-slate-600/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200 backdrop-blur-sm placeholder-slate-400"
            placeholder="デッキ名を入力"
          />
        </div>
      </div>

      <!-- ボタン群 (モバイル最適化) -->
      <div class="flex flex-wrap gap-1.5 sm:gap-3 mb-3 px-2">
        <button
          @click="generateAndShowDeckCode"
          :disabled="deckCards.length === 0 || isGeneratingCode"
          class="group relative flex-1 min-w-0 px-2 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-md sm:rounded-lg text-xs sm:text-sm font-medium hover:from-blue-700 hover:to-blue-800 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-blue-500/25"
          title="デッキコードを生成"
        >
          <span
            v-if="!isGeneratingCode"
            class="flex items-center justify-center gap-1 sm:gap-2"
          >
            <svg
              class="w-3 h-3 sm:w-4 sm:h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              ></path>
            </svg>
            <span class="hidden sm:inline">コード生成</span>
            <span class="sm:hidden">コード</span>
          </span>
          <span v-else class="flex items-center justify-center gap-1 sm:gap-2">
            <svg
              class="w-3 h-3 sm:w-4 sm:h-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            生成中...
          </span>
        </button>
        <button
          @click="saveDeckAsPng"
          :disabled="deckCards.length === 0 || isSaving"
          class="group relative flex-1 min-w-0 px-2 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-md sm:rounded-lg text-xs sm:text-sm font-medium hover:from-emerald-700 hover:to-emerald-800 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-emerald-500/25"
          title="デッキ画像を保存"
        >
          <span
            v-if="!isSaving"
            class="flex items-center justify-center gap-1 sm:gap-2"
          >
            <svg
              class="w-3 h-3 sm:w-4 sm:h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              ></path>
            </svg>
            <span class="hidden sm:inline">保存</span>
            <span class="sm:hidden">保存</span>
          </span>
          <span v-else class="flex items-center justify-center gap-1 sm:gap-2">
            <svg
              class="w-3 h-3 sm:w-4 sm:h-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            保存中...
          </span>
        </button>
        <button
          @click="resetDeck"
          :disabled="deckCards.length === 0"
          class="group relative flex-1 min-w-0 px-2 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-md sm:rounded-lg text-xs sm:text-sm font-medium hover:from-red-700 hover:to-red-800 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-red-500/25"
          title="デッキをリセット"
        >
          <span class="flex items-center justify-center gap-1 sm:gap-2">
            <svg
              class="w-3 h-3 sm:w-4 sm:h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              ></path>
            </svg>
            <span class="hidden sm:inline">リセット</span>
            <span class="sm:hidden">リセット</span>
          </span>
        </button>
      </div>

      <!-- 合計枚数表示 (モバイル最適化) -->
      <div class="text-center mb-2 sm:mb-4">
        <div
          class="inline-flex items-center gap-2 sm:gap-3 px-2 sm:px-4 py-1.5 sm:py-2 bg-slate-800/60 backdrop-blur-sm rounded-md sm:rounded-lg border border-slate-600/50"
        >
          <span class="text-xs sm:text-sm font-medium text-slate-300"
            >合計枚数:</span
          >
          <span
            class="text-sm sm:text-lg font-bold"
            :class="[
              totalDeckCards === 60
                ? 'text-green-400'
                : totalDeckCards > 50
                ? 'text-yellow-400'
                : 'text-slate-100',
            ]"
          >
            {{ totalDeckCards }}
          </span>
          <span class="text-xs sm:text-sm text-slate-400">/ 60</span>
          <div
            class="w-16 sm:w-24 h-1.5 sm:h-2 bg-slate-700 rounded-full overflow-hidden"
          >
            <div
              class="h-full transition-all duration-300 rounded-full"
              :class="[
                totalDeckCards === 60
                  ? 'bg-green-500'
                  : totalDeckCards > 50
                  ? 'bg-yellow-500'
                  : 'bg-blue-500',
              ]"
              :style="{ width: `${(totalDeckCards / 60) * 100}%` }"
            ></div>
          </div>
        </div>
      </div>

      <div
        id="chosen-deck-grid"
        class="flex-grow overflow-y-auto grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3 p-2 sm:p-4 bg-slate-800/40 backdrop-blur-sm rounded-lg sm:rounded-xl border border-slate-700/50 shadow-xl"
      >
        <div
          v-for="item in sortedDeckCards"
          :key="item.card.id"
          class="group flex flex-col items-center relative h-fit transition-all duration-200 hover:scale-105"
        >
          <div
            class="w-full relative overflow-hidden rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <img
              :src="getCardImageUrl(item.card.id)"
              @error="handleImageError"
              :alt="item.card.name"
              class="block w-full h-full object-cover transition-transform duration-200 group-hover:scale-110"
            />
            <div
              class="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-slate-900/80 via-slate-900/40 to-transparent rounded-b-lg"
            ></div>
            <div
              class="absolute top-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            >
              <div
                class="text-xs font-medium text-white bg-slate-900/80 rounded px-2 py-1 backdrop-blur-sm truncate"
              >
                {{ item.card.name }}
              </div>
            </div>
          </div>

          <div
            class="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex items-center justify-center space-x-2"
          >
            <button
              @click="decrementCardCount(item.card.id)"
              class="w-7 h-7 sm:w-9 sm:h-9 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-full flex items-center justify-center leading-none transition-all duration-200 shadow-lg hover:shadow-red-500/25 hover:scale-110"
            >
              <svg
                class="w-3 h-3 sm:w-4 sm:h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M20 12H4"
                ></path>
              </svg>
            </button>
            <div
              class="w-8 h-7 sm:w-10 sm:h-9 font-bold text-center flex items-center justify-center bg-slate-900/80 backdrop-blur-sm rounded-lg border border-slate-600/50 text-white text-sm sm:text-base"
            >
              {{ item.count }}
            </div>
            <button
              @click="incrementCardCount(item.card.id)"
              class="w-7 h-7 sm:w-9 sm:h-9 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-full flex items-center justify-center leading-none transition-all duration-200 shadow-lg hover:shadow-emerald-500/25 hover:scale-110 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed disabled:hover:scale-100"
              :disabled="item.count >= 4 || totalDeckCards >= 60"
            >
              <svg
                class="w-3 h-3 sm:w-4 sm:h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                ></path>
              </svg>
            </button>
          </div>
        </div>
        <div
          v-if="deckCards.length === 0"
          class="col-span-full text-center mt-4 sm:mt-8"
        >
          <div class="flex flex-col items-center gap-2 sm:gap-4 p-4 sm:p-8">
            <div
              class="w-12 h-12 sm:w-16 sm:h-16 bg-slate-700/50 rounded-full flex items-center justify-center"
            >
              <svg
                class="w-6 h-6 sm:w-8 sm:h-8 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                ></path>
              </svg>
            </div>
            <div class="text-slate-400 text-center">
              <p class="text-base sm:text-lg font-medium mb-1">
                デッキが空です
              </p>
              <p class="text-xs sm:text-sm">
                下の一覧からカードをタップして追加してください
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- カード一覧セクション -->
    <div
      class="flex flex-col flex-grow h-1/2 p-2 sm:p-4 overflow-hidden relative z-10"
    >
      <div class="flex items-center justify-between mb-2 sm:mb-4 px-2">
        <h2
          class="text-lg sm:text-xl font-bold text-slate-100 flex items-center gap-1 sm:gap-2"
        >
          <svg
            class="w-5 h-5 sm:w-6 sm:h-6 text-blue-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            ></path>
          </svg>
          カード一覧
        </h2>
        <button
          @click="openFilterModal"
          class="group px-2 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-md sm:rounded-lg text-xs sm:text-sm font-medium hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-blue-500/25"
          title="フィルター・検索"
        >
          <span class="flex items-center gap-1 sm:gap-2">
            <svg
              class="w-3 h-3 sm:w-4 sm:h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.414A1 1 0 013 6.586V4z"
              ></path>
            </svg>
            <span class="hidden sm:inline">検索/絞り込み</span>
            <span class="sm:hidden">検索</span>
          </span>
        </button>
      </div>

      <div
        class="flex-grow overflow-y-auto grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3 p-2 sm:p-4 bg-slate-800/40 backdrop-blur-sm rounded-lg sm:rounded-xl border border-slate-700/50 shadow-xl"
      >
        <div v-if="isLoading" class="col-span-full text-center mt-4 sm:mt-8">
          <div class="flex flex-col items-center gap-2 sm:gap-4 p-4 sm:p-8">
            <div
              class="animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-4 border-slate-600 border-t-blue-500"
            ></div>
            <div class="text-slate-400 text-center">
              <p class="text-base sm:text-lg font-medium mb-1">読み込み中...</p>
              <p class="text-xs sm:text-sm">カードデータを取得しています</p>
            </div>
          </div>
        </div>
        <div v-else-if="error" class="col-span-full text-center mt-4 sm:mt-8">
          <div class="flex flex-col items-center gap-2 sm:gap-4 p-4 sm:p-8">
            <div
              class="w-12 h-12 sm:w-16 sm:h-16 bg-red-500/20 rounded-full flex items-center justify-center"
            >
              <svg
                class="w-6 h-6 sm:w-8 sm:h-8 text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                ></path>
              </svg>
            </div>
            <div class="text-red-400 text-center">
              <p class="text-base sm:text-lg font-medium mb-1">
                エラーが発生しました
              </p>
              <p class="text-xs sm:text-sm">{{ error }}</p>
            </div>
          </div>
        </div>
        <div
          v-else-if="sortedAndFilteredAvailableCards.length === 0"
          class="col-span-full text-center mt-4 sm:mt-8"
        >
          <div class="flex flex-col items-center gap-2 sm:gap-4 p-4 sm:p-8">
            <div
              class="w-12 h-12 sm:w-16 sm:h-16 bg-slate-700/50 rounded-full flex items-center justify-center"
            >
              <svg
                class="w-6 h-6 sm:w-8 sm:h-8 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                ></path>
              </svg>
            </div>
            <div class="text-slate-400 text-center">
              <p class="text-base sm:text-lg font-medium mb-1">
                カードが見つかりません
              </p>
              <p class="text-xs sm:text-sm">検索条件を変更してみてください</p>
            </div>
          </div>
        </div>
        <div
          v-else
          v-for="card in sortedAndFilteredAvailableCards"
          :key="card.id"
          class="group flex flex-col items-center cursor-pointer transition-all duration-200 hover:scale-105 active:scale-95"
          @click="addCardToDeck(card)"
          title="デッキに追加"
        >
          <div
            class="w-full relative overflow-hidden rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <img
              :src="getCardImageUrl(card.id)"
              @error="handleImageError"
              :alt="card.name"
              class="block w-full h-full object-cover transition-transform duration-200 group-hover:scale-110"
            />
            <div
              class="absolute inset-0 bg-gradient-to-t from-slate-900/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            ></div>
            <div
              class="absolute top-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            >
              <div
                class="text-xs font-medium text-white bg-slate-900/80 rounded px-2 py-1 backdrop-blur-sm truncate"
              >
                {{ card.name }}
              </div>
            </div>
            <div
              class="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            >
              <div
                class="w-8 h-8 bg-emerald-500/90 backdrop-blur-sm rounded-full flex items-center justify-center"
              >
                <svg
                  class="w-4 h-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  ></path>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- フィルターモーダル -->
    <div
      v-if="isFilterModalOpen"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50"
      @click.self="closeFilterModal"
    >
      <div
        class="bg-gray-800 rounded-t-lg p-4 w-full max-h-[90vh] overflow-y-auto"
      >
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-bold">検索・絞り込み</h3>
          <button
            @click="closeFilterModal"
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
            v-model="filterCriteria.text"
            class="w-full px-3 py-2 text-sm rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring focus:border-blue-500"
            placeholder="カード名、ID、タグを入力"
          />
        </div>

        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">種類で絞り込み</label>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
            <label
              v-for="kind in allKinds"
              :key="kind"
              class="flex items-center"
            >
              <input
                type="checkbox"
                :value="kind"
                v-model="filterCriteria.kind"
                class="form-checkbox h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded"
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
            <label
              v-for="type in allTypes"
              :key="type"
              class="flex items-center"
            >
              <input
                type="checkbox"
                :value="type"
                v-model="filterCriteria.type"
                class="form-checkbox h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded"
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
                v-model="filterCriteria.tags"
                class="form-checkbox h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded"
              />
              <span class="ml-2">{{ tag }}</span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <!-- デッキコードモーダル -->
    <div
      v-if="showDeckCodeModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      @click.self="showDeckCodeModal = false"
    >
      <div class="bg-gray-800 rounded-lg p-4 sm:p-6 w-full max-w-md">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-bold">デッキコード</h3>
          <button
            @click="showDeckCodeModal = false"
            class="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        <div class="mb-4">
          <div
            class="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-2"
          >
            <input
              type="text"
              v-model="deckCode"
              readonly
              class="flex-grow px-3 py-2 text-sm rounded bg-gray-700 border border-gray-600"
            />
            <button
              @click="copyDeckCode"
              class="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition duration-200 whitespace-nowrap"
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
              v-model="importDeckCode"
              class="flex-grow px-3 py-2 text-sm rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring focus:border-blue-500"
              placeholder="デッキコードを入力"
            />
            <button
              @click="importDeckFromCode"
              class="px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition duration-200 whitespace-nowrap"
            >
              インポート
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* デフォルトのスクロールバーを隠す */
::-webkit-scrollbar {
  display: none;
}
* {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* タッチデバイス向けの最適化 */
@media (hover: none) {
  button {
    -webkit-tap-highlight-color: transparent;
  }

  input[type="checkbox"] {
    min-width: 20px;
    min-height: 20px;
  }
}

/* モバイル向けの最適化 */
@media (max-width: 640px) {
  .grid {
    gap: 0.5rem;
  }

  button {
    padding: 0.5rem;
  }

  input[type="text"] {
    font-size: 16px; /* iOSでズームを防ぐ */
  }
}

/* タブレット向けの最適化 */
@media (min-width: 641px) and (max-width: 1024px) {
  .grid {
    gap: 0.75rem;
  }
}

/* デスクトップ向けの最適化 */
@media (min-width: 1025px) {
  .grid {
    gap: 1rem;
  }
}
</style>
