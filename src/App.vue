<script setup lang="ts">
import {
  ref,
  computed,
  onMounted,
  watch,
  type Ref,
  type ComputedRef,
} from "vue";
import html2canvas from "html2canvas-pro";

// ===================================
// 型定義 - Type Definitions
// ===================================

interface Card {
  id: string;
  name: string;
  kind: string;
  type: string | string[];
  tags?: string[];
}

interface DeckCard {
  card: Card;
  count: number;
}

interface FilterCriteria {
  text: string;
  kind: string[];
  type: string[];
  tags: string[];
}

interface ExportConfig {
  canvas: {
    width: number;
    height: number;
    backgroundColor: string;
    padding: string;
  };
  deckName: {
    fontSize: string;
    fontWeight: string;
    color: string;
    fontFamily: string;
  };
  grid: {
    gap: string;
  };
  card: {
    borderRadius: string;
  };
  badge: {
    backgroundColor: string;
    color: string;
    padding: string;
    borderRadius: string;
    fontSize: string;
  };
}

// ===================================
// 定数定義 - Constants
// ===================================

const GAME_CONSTANTS = {
  MAX_DECK_SIZE: 60,
  MAX_CARD_COPIES: 4,
  BATCH_SIZE_FOR_PRELOAD: 10,
} as const;

const CARD_KINDS = ["Artist", "Song", "Magic", "Direction"];

const CARD_TYPES = ["赤", "青", "黄", "白", "黒", "全", "即時", "装備", "設置"];

const PRIORITY_TAGS = [
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

const EXPORT_CONFIG: ExportConfig = {
  canvas: {
    width: 1920,
    height: 1080,
    backgroundColor: "#030712",
    padding: "0 10px 10px 10px",
  },
  deckName: {
    fontSize: "80px",
    fontWeight: "bold",
    color: "#f9fafb",
    fontFamily: "serif",
  },
  grid: {
    gap: "4px",
  },
  card: {
    borderRadius: "8px",
  },
  badge: {
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    color: "white",
    padding: "2px 12px",
    borderRadius: "12px",
    fontSize: "32px",
  },
} as const;

// ===================================
// ユーティリティ関数 - Utility Functions
// ===================================

// 自然順ソート関数
const createNaturalSort = () => {
  return (a: string, b: string): number => {
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
};

// ソート関数群
const createSortFunctions = () => {
  const naturalSort = createNaturalSort();

  const kindSort = (a: { kind: string }, b: { kind: string }): number => {
    const indexA = CARD_KINDS.findIndex((kind) => kind === a.kind);
    const indexB = CARD_KINDS.findIndex((kind) => kind === b.kind);
    return indexA - indexB;
  };

  const typeSort = (
    a: { type: string | string[] },
    b: { type: string | string[] }
  ): number => {
    const getEarliestTypeIndex = (cardTypes: string | string[]): number => {
      if (!cardTypes) return CARD_TYPES.length;
      const types = Array.isArray(cardTypes) ? cardTypes : [cardTypes];
      let minIndex = CARD_TYPES.length;
      types.forEach((type: string) => {
        const index = CARD_TYPES.findIndex((t) => t === type);
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

  return { naturalSort, kindSort, typeSort };
};

// フィルター関数
const createCardFilter = () => {
  return (cards: Card[], criteria: FilterCriteria): Card[] => {
    const textLower = criteria.text.toLowerCase();
    const kindSet = new Set(criteria.kind);
    const typeSet = new Set(criteria.type);
    const tagSet = new Set(criteria.tags);

    return cards.filter((card: Card) => {
      // テキスト検索
      if (
        textLower &&
        !(
          card.name.toLowerCase().includes(textLower) ||
          card.id.toLowerCase().includes(textLower) ||
          (Array.isArray(card.tags) &&
            card.tags.some((tag: string) =>
              tag.toLowerCase().includes(textLower)
            ))
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
        if (!cardTypes.some((type: string) => typeSet.has(type))) {
          return false;
        }
      }

      // タグフィルター
      if (
        tagSet.size > 0 &&
        !(
          Array.isArray(card.tags) &&
          card.tags.some((tag: string) => tagSet.has(tag))
        )
      ) {
        return false;
      }

      return true;
    });
  };
};

// エラーハンドリング
const createErrorHandler = () => {
  return (error: any, message: string): void => {
    console.error(message, error);
  };
};

// ===================================
// 画像関連機能 - Image Management
// ===================================

const createImageManager = () => {
  const cardCache = new Map<string, HTMLImageElement>();

  const getCardImageUrl = (cardId: string): string => {
    return `/waic-deckbuilder/cards/${cardId}.avif`;
  };

  const handleImageError = (event: Event): void => {
    const target = event.target as HTMLImageElement;
    target.src = "/waic-deckbuilder/placeholder.avif";
    target.onerror = null;
  };

  const preloadImages = (cards: Card[]): void => {
    const loadBatch = (startIndex: number): void => {
      const endIndex = Math.min(
        startIndex + GAME_CONSTANTS.BATCH_SIZE_FOR_PRELOAD,
        cards.length
      );
      const batch = cards.slice(startIndex, endIndex);

      batch.forEach((card: Card) => {
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

  return {
    getCardImageUrl,
    handleImageError,
    preloadImages,
  };
};

// ===================================
// ローカルストレージ管理 - Local Storage Management
// ===================================

const createLocalStorageManager = () => {
  const handleError = createErrorHandler();

  const saveDeckToLocalStorage = (deck: DeckCard[]): void => {
    try {
      const simpleDeck = deck.map((item: DeckCard) => ({
        id: item.card.id,
        count: item.count,
      }));
      localStorage.setItem("deckCards_k", JSON.stringify(simpleDeck));
    } catch (e) {
      handleError(e, "デッキの保存に失敗しました");
    }
  };

  const loadDeckFromLocalStorage = (availableCards: Card[]): DeckCard[] => {
    try {
      const savedDeck = localStorage.getItem("deckCards_k");
      if (!savedDeck) return [];

      const simpleDeck: { id: string; count: number }[] = JSON.parse(savedDeck);
      return simpleDeck
        .map((item: { id: string; count: number }) => {
          const card = availableCards.find((c: Card) => c.id === item.id);
          return card ? { card: card, count: item.count } : null;
        })
        .filter((item: DeckCard | null): item is DeckCard => item !== null);
    } catch (e) {
      handleError(e, "保存されたデッキの読み込みに失敗しました");
      localStorage.removeItem("deckCards_k");
      localStorage.removeItem("deckName_k");
      return [];
    }
  };

  const saveDeckName = (name: string): void => {
    localStorage.setItem("deckName_k", name);
  };

  const loadDeckName = (): string => {
    return localStorage.getItem("deckName_k") || "新しいデッキ";
  };

  return {
    saveDeckToLocalStorage,
    loadDeckFromLocalStorage,
    saveDeckName,
    loadDeckName,
  };
};

// ===================================
// デッキコード管理 - Deck Code Management
// ===================================

const createDeckCodeManager = () => {
  const encodeDeckCode = (deck: DeckCard[]): string => {
    const cardIds = deck.flatMap((item: DeckCard) =>
      Array(item.count).fill(item.card.id)
    );
    return cardIds.join("/");
  };

  const decodeDeckCode = (code: string, availableCards: Card[]): DeckCard[] => {
    const cardIds = code.split("/");
    const cardCounts = new Map<string, number>();

    cardIds.forEach((id: string) => {
      cardCounts.set(id, (cardCounts.get(id) || 0) + 1);
    });

    const cards: DeckCard[] = [];
    for (const [id, count] of cardCounts) {
      const card = availableCards.find((c: Card) => c.id === id);
      if (card) {
        cards.push({ card, count });
      }
    }

    return cards;
  };

  return {
    encodeDeckCode,
    decodeDeckCode,
  };
};

// ===================================
// 画像エクスポート機能 - Image Export
// ===================================

const createImageExporter = () => {
  const { getCardImageUrl } = createImageManager();

  const calculateCardWidth = (cardCount: number): string => {
    if (cardCount <= 30) return "calc((100% - 36px) / 10)";
    if (cardCount <= 48) return "calc((100% - 44px) / 12)";
    return "calc((100% - 56px) / 15)";
  };

  const applyStyles = (
    element: HTMLElement,
    styles: Record<string, string>
  ): void => {
    Object.assign(element.style, styles);
  };

  const createExportContainer = (): HTMLElement => {
    const container = document.createElement("div");
    applyStyles(container, {
      width: `${EXPORT_CONFIG.canvas.width}px`,
      height: `${EXPORT_CONFIG.canvas.height}px`,
      backgroundColor: EXPORT_CONFIG.canvas.backgroundColor,
      padding: EXPORT_CONFIG.canvas.padding,
      position: "absolute",
      left: "-9999px",
    });
    document.body.appendChild(container);
    return container;
  };

  const createDeckNameElement = (name: string): HTMLElement => {
    const element = document.createElement("div");
    applyStyles(element, {
      position: "absolute",
      fontSize: EXPORT_CONFIG.deckName.fontSize,
      fontWeight: EXPORT_CONFIG.deckName.fontWeight,
      color: EXPORT_CONFIG.deckName.color,
      fontFamily: EXPORT_CONFIG.deckName.fontFamily,
      textAlign: "center",
      width: "100%",
    });
    element.textContent = name;
    return element;
  };

  const createGridElement = (): HTMLElement => {
    const grid = document.createElement("div");
    applyStyles(grid, {
      display: "flex",
      flexWrap: "wrap",
      gap: EXPORT_CONFIG.grid.gap,
      width: "100%",
      height: "100%",
      justifyContent: "flex-start",
      alignItems: "center",
      alignContent: "center",
    });
    return grid;
  };

  const createCardElement = async (
    item: DeckCard,
    cardWidth: string
  ): Promise<HTMLElement> => {
    const cardContainer = document.createElement("div");
    applyStyles(cardContainer, {
      position: "relative",
      width: cardWidth,
    });

    // 画像要素
    const img = document.createElement("img");
    img.src = getCardImageUrl(item.card.id);
    applyStyles(img, {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      borderRadius: EXPORT_CONFIG.card.borderRadius,
    });

    // 画像読み込み待機
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
    });

    cardContainer.appendChild(img);

    // カウントバッジ
    const countBadge = document.createElement("div");
    applyStyles(countBadge, {
      position: "absolute",
      bottom: "5px",
      right: "5px",
      backgroundColor: EXPORT_CONFIG.badge.backgroundColor,
      color: EXPORT_CONFIG.badge.color,
      padding: EXPORT_CONFIG.badge.padding,
      borderRadius: EXPORT_CONFIG.badge.borderRadius,
      fontSize: EXPORT_CONFIG.badge.fontSize,
      fontWeight: "bold",
    });
    countBadge.textContent = `×${item.count}`;
    cardContainer.appendChild(countBadge);

    return cardContainer;
  };

  const generateFileName = (deckName: string): string => {
    const timestamp = new Date()
      .toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })
      .replace(/\//g, "-");
    return `${deckName || "デッキ"}_${timestamp}.png`;
  };

  const downloadCanvas = (
    canvas: HTMLCanvasElement,
    filename: string
  ): void => {
    const link = document.createElement("a");
    link.download = filename;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const exportDeckAsImage = async (
    deckCards: DeckCard[],
    deckName: string,
    onStart: () => void,
    onComplete: () => void,
    onError: (error: any) => void
  ): Promise<void> => {
    onStart();

    try {
      // コンテナ作成
      const container = createExportContainer();

      // デッキ名要素追加
      const deckNameElement = createDeckNameElement(deckName);
      container.appendChild(deckNameElement);

      // グリッド作成
      const grid = createGridElement();
      container.appendChild(grid);

      // カード要素作成・追加
      const cardWidth = calculateCardWidth(deckCards.length);
      const cardPromises = deckCards.map(async (item: DeckCard) => {
        const cardElement = await createCardElement(item, cardWidth);
        grid.appendChild(cardElement);
      });

      await Promise.all(cardPromises);

      // Canvas生成
      const canvas = await html2canvas(container, {
        scale: 1,
        width: EXPORT_CONFIG.canvas.width,
        height: EXPORT_CONFIG.canvas.height,
        useCORS: true,
        logging: false,
        allowTaint: true,
        backgroundColor: "#1F2937",
      });

      // クリーンアップ
      document.body.removeChild(container);

      // ダウンロード
      const filename = generateFileName(deckName);
      downloadCanvas(canvas, filename);

      console.log(`デッキ画像を保存しました: ${filename}`);
    } catch (e) {
      onError(e);
    } finally {
      onComplete();
    }
  };

  return {
    exportDeckAsImage,
  };
};

// ===================================
// 状態管理 - State Management
// ===================================

// カードデータ関連
const availableCards: Ref<Card[]> = ref([]);
const deckCards: Ref<DeckCard[]> = ref([]);
const deckName: Ref<string> = ref("新しいデッキ");
const deckCode: Ref<string> = ref("");
const importDeckCode: Ref<string> = ref("");

// UI状態管理
const isLoading: Ref<boolean> = ref(true);
const error: Ref<string | null> = ref(null);
const isSaving: Ref<boolean> = ref(false);
const isGeneratingCode: Ref<boolean> = ref(false);
const showDeckCodeModal: Ref<boolean> = ref(false);
const isFilterModalOpen: Ref<boolean> = ref(false);

// フィルター・検索関連
const filterCriteria: Ref<FilterCriteria> = ref({
  text: "",
  kind: [],
  type: [],
  tags: [],
});

// ===================================
// マネージャーインスタンス作成
// ===================================

const sortFunctions = createSortFunctions();
const cardFilter = createCardFilter();
const handleError = createErrorHandler();
const imageManager = createImageManager();
const localStorageManager = createLocalStorageManager();
const deckCodeManager = createDeckCodeManager();
const imageExporter = createImageExporter();

// ===================================
// Computed Properties
// ===================================

// 全タグリスト（優先タグを先頭に配置）
const allTags: ComputedRef<string[]> = computed(() => {
  const tags = new Set<string>();
  availableCards.value.forEach((card: Card) => {
    if (Array.isArray(card.tags)) {
      card.tags.forEach((tag: string) => tags.add(tag));
    }
  });

  const priorityTagSet = new Set(PRIORITY_TAGS);
  const otherTags = Array.from(tags)
    .filter((tag: string) => !priorityTagSet.has(tag))
    .sort();

  return [
    ...PRIORITY_TAGS.filter((tag: string) => tags.has(tag)),
    ...otherTags,
  ];
});

// ソート・フィルター済みカード一覧
const sortedAndFilteredAvailableCards: ComputedRef<Card[]> = computed(() => {
  const filtered = cardFilter(availableCards.value, filterCriteria.value);
  const sorted = [...filtered];

  sorted.sort((a: Card, b: Card) => {
    const kindComparison = sortFunctions.kindSort(a, b);
    if (kindComparison !== 0) return kindComparison;

    const typeComparison = sortFunctions.typeSort(a, b);
    if (typeComparison !== 0) return typeComparison;

    return sortFunctions.naturalSort(a.id, b.id);
  });

  return sorted;
});

// ソート済みデッキカード
const sortedDeckCards: ComputedRef<DeckCard[]> = computed(() => {
  const sorted = [...deckCards.value];

  sorted.sort((a: DeckCard, b: DeckCard) => {
    const cardA = a.card;
    const cardB = b.card;

    const kindComparison = sortFunctions.kindSort(
      { kind: cardA.kind },
      { kind: cardB.kind }
    );
    if (kindComparison !== 0) return kindComparison;

    const typeComparison = sortFunctions.typeSort(
      { type: cardA.type },
      { type: cardB.type }
    );
    if (typeComparison !== 0) return typeComparison;

    return sortFunctions.naturalSort(cardA.id, cardB.id);
  });

  return sorted;
});

// デッキの合計枚数
const totalDeckCards: ComputedRef<number> = computed(() => {
  return deckCards.value.reduce(
    (sum: number, item: DeckCard) => sum + item.count,
    0
  );
});

// ===================================
// データ操作 - Data Management
// ===================================

// カードデータ読み込み
const loadCards = async (): Promise<void> => {
  isLoading.value = true;
  error.value = null;

  try {
    const response = await fetch("/waic-deckbuilder/cards.json");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data: Card[] = await response.json();
    availableCards.value = data;
    imageManager.preloadImages(data);

    // ローカルストレージからデッキを読み込み
    deckCards.value = localStorageManager.loadDeckFromLocalStorage(data);
    deckName.value = localStorageManager.loadDeckName();
  } catch (e) {
    console.error("カードデータの読み込みに失敗しました:", e);
    error.value =
      "カードデータの読み込みに失敗しました。ページを再読み込みしてください。";
  } finally {
    isLoading.value = false;
  }
};

// ===================================
// UI操作 - UI Interactions
// ===================================

// フィルターモーダル操作
const openFilterModal = (): void => {
  isFilterModalOpen.value = true;
};

const closeFilterModal = (): void => {
  isFilterModalOpen.value = false;
};

// ===================================
// デッキ操作 - Deck Management
// ===================================

// カードをデッキに追加
const addCardToDeck = (card: Card): void => {
  if (totalDeckCards.value >= GAME_CONSTANTS.MAX_DECK_SIZE) {
    return;
  }

  const existingCardIndex = deckCards.value.findIndex(
    (item: DeckCard) => item.card.id === card.id
  );

  if (existingCardIndex > -1) {
    if (
      deckCards.value[existingCardIndex].count < GAME_CONSTANTS.MAX_CARD_COPIES
    ) {
      deckCards.value[existingCardIndex].count++;
    }
  } else {
    deckCards.value.push({ card: card, count: 1 });
  }
};

// カード枚数を増やす
const incrementCardCount = (cardId: string): void => {
  if (totalDeckCards.value >= GAME_CONSTANTS.MAX_DECK_SIZE) {
    return;
  }
  const item = deckCards.value.find(
    (item: DeckCard) => item.card.id === cardId
  );
  if (item && item.count < GAME_CONSTANTS.MAX_CARD_COPIES) {
    item.count++;
  }
};

// カード枚数を減らす
const decrementCardCount = (cardId: string): void => {
  const item = deckCards.value.find(
    (item: DeckCard) => item.card.id === cardId
  );
  if (item && item.count > 1) {
    item.count--;
  } else if (item && item.count === 1) {
    removeCardFromDeck(cardId);
  }
};

// カードをデッキから削除
const removeCardFromDeck = (cardId: string): void => {
  deckCards.value = deckCards.value.filter(
    (item: DeckCard) => item.card.id !== cardId
  );
};

// デッキをリセット
const resetDeck = (): void => {
  if (confirm("デッキ内容を全てリセットしてもよろしいですか？")) {
    deckCards.value = [];
    deckName.value = "新しいデッキ";
    localStorage.removeItem("deckCards_k");
    localStorage.removeItem("deckName_k");
  }
};

// ===================================
// デッキコード機能
// ===================================

// デッキコード生成・表示
const generateAndShowDeckCode = (): void => {
  isGeneratingCode.value = true;
  try {
    deckCode.value = deckCodeManager.encodeDeckCode(deckCards.value);
    showDeckCodeModal.value = true;
  } catch (e) {
    console.error("デッキコードの生成に失敗しました:", e);
  } finally {
    isGeneratingCode.value = false;
  }
};

// デッキコードをコピー
const copyDeckCode = (): void => {
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
const importDeckFromCode = (): void => {
  try {
    const importedCards = deckCodeManager.decodeDeckCode(
      importDeckCode.value,
      availableCards.value
    );
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
// 画像保存機能
// ===================================

const saveDeckAsPng = async (): Promise<void> => {
  await imageExporter.exportDeckAsImage(
    sortedDeckCards.value,
    deckName.value,
    () => (isSaving.value = true),
    () => (isSaving.value = false),
    (error) => handleError(error, "デッキ画像の保存に失敗しました")
  );
};

// ===================================
// ライフサイクル・ウォッチャー
// ===================================

// コンポーネントマウント時の処理
onMounted(() => {
  loadCards();
});

// デッキ変更時のローカルストレージ保存
watch(
  deckCards,
  (newDeck: DeckCard[]) => {
    localStorageManager.saveDeckToLocalStorage(newDeck);
  },
  { deep: true }
);

watch(deckName, (newName: string) => {
  localStorageManager.saveDeckName(newName);
});

// ===================================
// テンプレートで使用する関数とデータ
// ===================================

// 定数をテンプレートで使用するためにエクスポート
const allKinds = [...CARD_KINDS];
const allTypes = [...CARD_TYPES];

// 画像関連の関数をテンプレートで使用するためにエクスポート
const { getCardImageUrl, handleImageError } = imageManager;
</script>

<template>
  <div
    class="flex flex-col h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100 font-sans relative overflow-hidden"
    @contextmenu.prevent
    @selectstart.prevent
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
      class="flex flex-col flex-grow-0 h-1/2 p-1 sm:p-2 border-b border-slate-700/50 overflow-hidden relative z-10 backdrop-blur-sm"
    >
      <!-- デッキ名入力 (モバイル優先) -->
      <div class="mb-1 px-1">
        <div class="flex items-center w-full">
          <label
            for="deckName"
            class="mr-1 sm:mr-2 text-xs font-medium text-slate-300 whitespace-nowrap"
            >デッキ名:</label
          >
          <input
            id="deckName"
            type="text"
            v-model="deckName"
            class="flex-grow px-1 sm:px-2 py-0.5 sm:py-1 text-xs rounded bg-slate-800/80 border border-slate-600/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200 backdrop-blur-sm placeholder-slate-400"
            placeholder="デッキ名を入力"
          />
        </div>
      </div>

      <!-- ボタン群 (モバイル最適化) -->
      <div class="flex flex-wrap gap-1 mb-1 px-1">
        <button
          @click="generateAndShowDeckCode"
          :disabled="isGeneratingCode"
          class="group relative flex-1 min-w-0 px-1 sm:px-2 py-0.5 sm:py-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded text-xs font-medium hover:from-blue-700 hover:to-blue-800 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-blue-500/25"
          title="デッキコードを生成"
        >
          <span
            v-if="!isGeneratingCode"
            class="flex items-center justify-center gap-1"
          >
            <svg
              class="w-3 h-3"
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
          <span v-else class="flex items-center justify-center gap-1">
            <svg class="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
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
          class="group relative flex-1 min-w-0 px-1 sm:px-2 py-0.5 sm:py-1 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded text-xs font-medium hover:from-emerald-700 hover:to-emerald-800 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-emerald-500/25"
          title="デッキ画像を保存"
        >
          <span v-if="!isSaving" class="flex items-center justify-center gap-1">
            <svg
              class="w-3 h-3"
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
          <span v-else class="flex items-center justify-center gap-1">
            <svg class="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
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
          class="group relative flex-1 min-w-0 px-1 sm:px-2 py-0.5 sm:py-1 bg-gradient-to-r from-red-600 to-red-700 text-white rounded text-xs font-medium hover:from-red-700 hover:to-red-800 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-red-500/25"
          title="デッキをリセット"
        >
          <span class="flex items-center justify-center gap-1">
            <svg
              class="w-3 h-3"
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
      <div class="text-center mb-1">
        <div
          class="inline-flex items-center gap-1 sm:gap-2 px-1 sm:px-2 py-0.5 sm:py-1 bg-slate-800/60 backdrop-blur-sm rounded border border-slate-600/50"
        >
          <span class="text-xs font-medium text-slate-300">合計枚数:</span>
          <span
            class="text-sm font-bold"
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
          <span class="text-xs text-slate-400">/ 60</span>
          <div
            class="w-12 sm:w-16 h-1 bg-slate-700 rounded-full overflow-hidden"
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
        class="flex-grow overflow-y-auto grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1 sm:gap-2 p-1 sm:p-2 bg-slate-800/40 backdrop-blur-sm rounded border border-slate-700/50 shadow-xl"
      >
        <div
          v-for="item in sortedDeckCards"
          :key="item.card.id"
          class="group flex flex-col items-center relative h-fit transition-all duration-200"
        >
          <div
            class="w-full relative overflow-hidden rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <img
              :src="getCardImageUrl(item.card.id)"
              @error="handleImageError"
              :alt="item.card.name"
              class="block w-full h-full object-cover transition-transform duration-200"
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
              class="w-7 h-7 sm:w-9 sm:h-9 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-full flex items-center justify-center leading-none transition-all duration-200 shadow-lg hover:shadow-red-500/25"
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
              class="w-7 h-7 sm:w-9 sm:h-9 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-full flex items-center justify-center leading-none transition-all duration-200 shadow-lg hover:shadow-emerald-500/25 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed"
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
          class="col-span-full text-center mt-2 sm:mt-4"
        >
          <div class="flex flex-col items-center gap-1 sm:gap-2 p-2 sm:p-4">
            <div
              class="w-8 h-8 sm:w-10 sm:h-10 bg-slate-700/50 rounded-full flex items-center justify-center"
            >
              <svg
                class="w-4 h-4 sm:w-5 sm:h-5 text-slate-400"
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
              <p class="text-sm sm:text-base font-medium mb-1">
                デッキが空です
              </p>
              <p class="text-xs">
                下の一覧からカードをタップして追加してください
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- カード一覧セクション -->
    <div
      class="flex flex-col flex-grow h-1/2 p-1 sm:p-2 overflow-hidden relative z-10"
    >
      <div class="flex items-center justify-between mb-1 px-1">
        <h2
          class="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-1"
        >
          <svg
            class="w-4 h-4 text-blue-400"
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
          class="group px-1 sm:px-2 py-0.5 sm:py-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded text-xs font-medium hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-blue-500/25"
          title="フィルター・検索"
        >
          <span class="flex items-center gap-1">
            <svg
              class="w-3 h-3"
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
        class="flex-grow overflow-y-auto grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1 sm:gap-2 p-1 sm:p-2 bg-slate-800/40 backdrop-blur-sm rounded border border-slate-700/50 shadow-xl"
      >
        <div v-if="isLoading" class="col-span-full text-center mt-2 sm:mt-4">
          <div class="flex flex-col items-center gap-1 sm:gap-2 p-2 sm:p-4">
            <div
              class="animate-spin rounded-full h-8 w-8 sm:h-10 sm:w-10 border-4 border-slate-600 border-t-blue-500"
            ></div>
            <div class="text-slate-400 text-center">
              <p class="text-sm sm:text-base font-medium mb-1">読み込み中...</p>
              <p class="text-xs">カードデータを取得しています</p>
            </div>
          </div>
        </div>
        <div v-else-if="error" class="col-span-full text-center mt-2 sm:mt-4">
          <div class="flex flex-col items-center gap-1 sm:gap-2 p-2 sm:p-4">
            <div
              class="w-8 h-8 sm:w-10 sm:h-10 bg-red-500/20 rounded-full flex items-center justify-center"
            >
              <svg
                class="w-4 h-4 sm:w-5 sm:h-5 text-red-400"
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
              <p class="text-sm sm:text-base font-medium mb-1">
                エラーが発生しました
              </p>
              <p class="text-xs">{{ error }}</p>
            </div>
          </div>
        </div>
        <div
          v-else-if="sortedAndFilteredAvailableCards.length === 0"
          class="col-span-full text-center mt-2 sm:mt-4"
        >
          <div class="flex flex-col items-center gap-1 sm:gap-2 p-2 sm:p-4">
            <div
              class="w-8 h-8 sm:w-10 sm:h-10 bg-slate-700/50 rounded-full flex items-center justify-center"
            >
              <svg
                class="w-4 h-4 sm:w-5 sm:h-5 text-slate-400"
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
              <p class="text-sm sm:text-base font-medium mb-1">
                カードが見つかりません
              </p>
              <p class="text-xs">検索条件を変更してみてください</p>
            </div>
          </div>
        </div>
        <div
          v-else
          v-for="card in sortedAndFilteredAvailableCards"
          :key="card.id"
          class="group flex flex-col items-center cursor-pointer transition-all duration-200 active:scale-95"
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
              class="block w-full h-full object-cover transition-transform duration-200"
            />
            <div
              class="absolute inset-0 bg-gradient-to-t from-slate-900/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            ></div>
          </div>
        </div>
      </div>
    </div>

    <!-- フィルターモーダル -->
    <div
      v-if="isFilterModalOpen"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click.self="closeFilterModal"
    >
      <div class="bg-gray-800 p-4 w-full h-full overflow-y-auto">
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
