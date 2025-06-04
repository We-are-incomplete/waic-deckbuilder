<script setup>
import { ref, computed, onMounted, watch } from "vue";
import html2canvas from "html2canvas-pro";

// --- 状態管理 ---
const availableCards = ref([]); // 全てのカードデータ
const deckCards = ref([]); // デッキに入っているカード { card: {}, count: N } の形式
const deckName = ref("新しいデッキ"); // デッキ名
const isLoading = ref(true); // データ読み込み中フラグ
const error = ref(null); // エラーメッセージ
const deckCode = ref(""); // デッキコード
const showDeckCodeModal = ref(false); // デッキコードモーダル表示状態
const importDeckCode = ref(""); // インポート用デッキコード

// ソートとフィルターの状態
const filterCriteria = ref({
  text: "",
  kind: [],
  type: [],
  tags: [],
});
const isFilterModalOpen = ref(false); // フィルターモーダル表示状態

// 利用可能な種類、タイプ、タグのリスト (フィルター用)
const allKinds = ["Artist", "Song", "Magic", "Direction"];
const allTypes = ["赤", "青", "黄", "白", "黒", "全", "即時", "装備", "設置"];

// 優先タグのリスト
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

const allTags = computed(() => {
  const tags = new Set();
  availableCards.value.forEach((card) => {
    if (Array.isArray(card.tags)) {
      card.tags.forEach((tag) => tags.add(tag));
    }
  });

  // 優先タグとその他のタグを分離
  const priorityTagSet = new Set(priorityTags);
  const otherTags = Array.from(tags)
    .filter((tag) => !priorityTagSet.has(tag))
    .sort();

  // 優先タグを先頭に配置し、その後にその他のタグを配置
  return [...priorityTags.filter((tag) => tags.has(tag)), ...otherTags];
});

// カードデータのキャッシュ
const cardCache = new Map();

// 画像のプリロードを最適化
const preloadImages = (cards) => {
  const batchSize = 10; // 一度に読み込む画像の数
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
      setTimeout(() => loadBatch(endIndex), 100); // 次のバッチを非同期で読み込み
    }
  };

  loadBatch(0);
};

// デバウンス関数の追加
const debounce = (fn, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

// フィルター処理を最適化
const filterCards = (cards, criteria) => {
  const textLower = criteria.text.toLowerCase();
  const kindSet = new Set(criteria.kind);
  const typeSet = new Set(criteria.type);
  const tagSet = new Set(criteria.tags);

  return cards.filter((card) => {
    // テキスト検索の最適化
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

// --- データ読み込み ---
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
    // 画像のプリロード
    preloadImages(data);
  } catch (e) {
    console.error("カードデータの読み込みに失敗しました:", e);
    error.value =
      "カードデータの読み込みに失敗しました。ページを再読み込みしてください。";
  } finally {
    isLoading.value = false;
  }
};

// コンポーネメントマウント時にデータを読み込む
onMounted(() => {
  loadCards();
  // 保存されたデッキ情報を読み込む (オプション機能として後述)
  loadDeckFromLocalStorage();
});

// デッキ情報が変更されたらローカルストレージに保存 (オプション)
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

// --- ソート・フィルター処理 ---

// 自然順ソート関数 (ID用: AA-1, AA-2, ..., AA-10)
const naturalSort = (a, b) => {
  const regex = /(\d+)|(\D+)/g;
  const tokensA = a.match(regex);
  const tokensB = b.match(regex);

  if (!tokensA || !tokensB) return a.localeCompare(b); // fallback if no numbers/letters

  for (let i = 0; i < Math.min(tokensA.length, tokensB.length); i++) {
    const tokenA = tokensA[i];
    const tokenB = tokensB[i];

    const numA = parseInt(tokenA, 10);
    const numB = parseInt(tokenB, 10);

    if (!isNaN(numA) && !isNaN(numB)) {
      // 両方が数値の場合、数値として比較
      if (numA !== numB) return numA - numB;
    } else {
      // 文字列の場合、大文字を優先して比較
      const charCodeA = tokenA.charCodeAt(0);
      const charCodeB = tokenB.charCodeAt(0);

      // 大文字と小文字の比較
      const isUpperA = charCodeA >= 65 && charCodeA <= 90;
      const isUpperB = charCodeB >= 65 && charCodeB <= 90;

      if (isUpperA !== isUpperB) {
        return isUpperA ? -1 : 1; // 大文字を優先
      }

      // 同じ大文字/小文字の場合は通常の文字列比較
      if (tokenA !== tokenB) return tokenA.localeCompare(tokenB);
    }
  }

  // 一方のトークンが尽きた場合、長い方が後
  return tokensA.length - tokensB.length;
};

// 種類ソート関数 (指定された順序)
const kindSort = (a, b) => {
  const order = allKinds;
  const indexA = order.indexOf(a.kind);
  const indexB = order.indexOf(b.kind);
  return indexA - indexB;
};

// タイプソート関数 (指定された順序、配列も考慮)
const typeSort = (a, b) => {
  const order = allTypes;

  // ヘルパー関数：カードのタイプの中で、指定順序で最も早いタイプのインデックスを取得
  const getEarliestTypeIndex = (cardTypes) => {
    if (!cardTypes) return order.length; // タイプがない場合は一番後ろ
    const types = Array.isArray(cardTypes) ? cardTypes : [cardTypes];
    let minIndex = order.length;
    types.forEach((type) => {
      const index = order.indexOf(type);
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

// 選べるカード一覧（ソートとフィルター適用済み）
const sortedAndFilteredAvailableCards = computed(() => {
  const filtered = filterCards(availableCards.value, filterCriteria.value);
  // デッキカードと同じソート順を適用
  const sorted = [...filtered];
  sorted.sort((a, b) => {
    // 1. 種類でソート
    const kindComparison = kindSort(a, b);
    if (kindComparison !== 0) return kindComparison;

    // 2. タイプでソート
    const typeComparison = typeSort(a, b);
    if (typeComparison !== 0) return typeComparison;

    // 3. IDでソート (種類とタイプが同じ場合)
    return naturalSort(a.id, b.id);
  });
  return sorted;
});

// 選んだカード一覧（自動ソート適用済み）
const sortedDeckCards = computed(() => {
  // デッキカードはID、種類、タイプの順でソート
  const sorted = [...deckCards.value];
  sorted.sort((a, b) => {
    const cardA = a.card;
    const cardB = b.card;

    // 1. 種類でソート
    const kindComparison = kindSort({ kind: cardA.kind }, { kind: cardB.kind }); // kindSortはオブジェクトを期待するのでラップ
    if (kindComparison !== 0) return kindComparison;

    // 2. タイプでソート
    const typeComparison = typeSort({ type: cardA.type }, { type: cardB.type }); // typeSortはオブジェクトを期待するのでラップ
    if (typeComparison !== 0) return typeComparison;

    // 3. IDでソート (種類とタイプが同じ場合)
    return naturalSort(cardA.id, cardB.id);
  });
  return sorted;
});

// デッキの合計枚数
const totalDeckCards = computed(() => {
  return deckCards.value.reduce((sum, item) => sum + item.count, 0);
});

// --- デッキ操作 ---

// 選べるカードをタップしたとき（デッキに追加）
const addCardToDeck = (card) => {
  if (totalDeckCards.value >= 60) {
    alert("デッキは60枚までです！");
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

// デッキ内のカード枚数を増やす
const incrementCardCount = (cardId) => {
  if (totalDeckCards.value >= 60) {
    alert("デッキは60枚までです！");
    return;
  }
  const item = deckCards.value.find((item) => item.card.id === cardId);
  if (item && item.count < 4) {
    item.count++;
  }
};

// デッキ内のカード枚数を減らす
const decrementCardCount = (cardId) => {
  const item = deckCards.value.find((item) => item.card.id === cardId);
  if (item && item.count > 1) {
    item.count--;
  } else if (item && item.count === 1) {
    // 1枚になったら削除
    removeCardFromDeck(cardId);
  }
};

// デッキからカードを削除
const removeCardFromDeck = (cardId) => {
  deckCards.value = deckCards.value.filter((item) => item.card.id !== cardId);
};

// デッキをリセット
const resetDeck = () => {
  if (confirm("デッキ内容を全てリセットしてもよろしいですか？")) {
    deckCards.value = [];
    deckName.value = "新しいデッキ";
    localStorage.removeItem("deckCards_k"); // ローカルストレージからも削除
    localStorage.removeItem("deckName_k");
  }
};

// --- 画像保存 ---

const saveDeckAsPng = async () => {
  const saveButton = document.querySelector('button[title="デッキ画像を保存"]');
  if (saveButton) {
    saveButton.disabled = true;
    saveButton.textContent = "保存中...";
  }

  try {
    const container = document.createElement("div");
    container.style.width = "1920px";
    container.style.height = "1080px";
    container.style.backgroundColor = "#030712";
    container.style.padding = "0 10px 10px 10px";
    container.style.position = "absolute";
    container.style.left = "-9999px";
    document.body.appendChild(container);

    // デッキ名の表示
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

    // カードグリッドの作成
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

    // カードの追加を最適化
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
  } catch (e) {
    handleError(e, "デッキ画像の保存に失敗しました");
  } finally {
    if (saveButton) {
      saveButton.disabled = false;
      saveButton.textContent = "保存";
    }
  }
};

// --- 画像パス取得とエラーハンドリング ---

const getCardImageUrl = (cardId) => {
  // publicディレクトリからのパス
  return `/waic-deckbuilder/cards/${cardId}.avif`;
};

// 画像読み込みエラー時の処理
const handleImageError = (event) => {
  event.target.src = "/waic-deckbuilder/placeholder.avif"; // プレースホルダー画像に切り替え
  event.target.onerror = null; // これ以上エラーが発生しないようにイベントハンドラを解除
};

// --- フィルターモーダル操作 ---

const openFilterModal = () => {
  isFilterModalOpen.value = true;
};

const closeFilterModal = () => {
  isFilterModalOpen.value = false;
  // フィルター適用ボタンで適用するなら、ここで状態をリセットまたは適用
  // 今回はチェックボックス変更で即時適用と仮定
};

// --- ローカルストレージ保存/読み込み (オプション) ---
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

// デッキコードのエンコード関数
const encodeDeckCode = (deck) => {
  // 各カードのIDを枚数分並べる
  const cardIds = deck.flatMap((item) => Array(item.count).fill(item.card.id));

  // スラッシュで区切って結合
  return cardIds.join("/");
};

// デッキコードのデコード関数
const decodeDeckCode = (code) => {
  const cardIds = code.split("/");

  // カードIDごとの枚数をカウント
  const cardCounts = new Map();
  cardIds.forEach((id) => {
    cardCounts.set(id, (cardCounts.get(id) || 0) + 1);
  });

  // カード情報を復元
  const cards = [];
  for (const [id, count] of cardCounts) {
    const card = availableCards.value.find((c) => c.id === id);
    if (card) {
      cards.push({ card, count });
    }
  }

  return cards;
};

// デッキコードを生成して表示
const generateAndShowDeckCode = () => {
  try {
    deckCode.value = encodeDeckCode(deckCards.value);
    showDeckCodeModal.value = true;
  } catch (e) {
    console.error("デッキコードの生成に失敗しました:", e);
    alert("デッキコードの生成に失敗しました。");
  }
};

// デッキコードをコピー
const copyDeckCode = () => {
  navigator.clipboard
    .writeText(deckCode.value)
    .then(() => {
      alert("デッキコードをコピーしました");
    })
    .catch(() => {
      alert("デッキコードのコピーに失敗しました");
    });
};

// デッキコードからデッキを復元
const importDeckFromCode = () => {
  try {
    const importedCards = decodeDeckCode(importDeckCode.value);
    if (importedCards.length > 0) {
      deckCards.value = importedCards;
      importDeckCode.value = "";
      showDeckCodeModal.value = false;
    } else {
      alert("有効なカードが見つかりませんでした");
    }
  } catch (e) {
    console.error("デッキコードの復元に失敗しました:", e);
    alert("デッキコードの復元に失敗しました。正しいコードを入力してください。");
  }
};

// エラーハンドリングの強化
const handleError = (error, message) => {
  console.error(message, error);
  alert(`${message}\n${error.message}`);
};
</script>

<template>
  <div class="flex flex-col h-screen bg-gray-800 text-gray-100 font-sans">
    <!-- デッキセクション -->
    <div
      class="flex flex-col flex-grow-0 h-1/2 p-2 border-b border-gray-700 overflow-hidden"
    >
      <div class="flex items-center justify-between mb-2 px-2 flex-wrap gap-2">
        <div class="flex items-center flex-grow min-w-[200px]">
          <label for="deckName" class="mr-2 text-sm whitespace-nowrap"
            >デッキ名:</label
          >
          <input
            id="deckName"
            type="text"
            v-model="deckName"
            class="flex-grow px-2 py-1 text-sm rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring focus:border-blue-500"
            placeholder="デッキ名を入力"
          />
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            @click="generateAndShowDeckCode"
            class="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition duration-200 whitespace-nowrap"
            title="デッキコードを生成"
          >
            コード生成
          </button>
          <button
            @click="saveDeckAsPng"
            class="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition duration-200 whitespace-nowrap"
            :disabled="deckCards.length === 0"
            title="デッキ画像を保存"
          >
            保存
          </button>
          <button
            @click="resetDeck"
            class="px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition duration-200 whitespace-nowrap"
            :disabled="deckCards.length === 0"
            title="デッキをリセット"
          >
            リセット
          </button>
        </div>
      </div>

      <div class="text-center text-sm mb-2">
        合計枚数: {{ totalDeckCards }} / 60
      </div>

      <div
        id="chosen-deck-grid"
        class="flex-grow overflow-y-auto grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 p-2 bg-gray-700 rounded"
      >
        <div
          v-for="item in sortedDeckCards"
          :key="item.card.id"
          class="flex flex-col items-center relative h-fit"
        >
          <div class="w-full relative">
            <img
              :src="getCardImageUrl(item.card.id)"
              @error="handleImageError"
              :alt="item.card.name"
              class="block w-full h-full object-cover rounded"
            />
            <div
              class="absolute bottom-0 left-0 right-0 h-1/6 bg-gray-900/50 rounded-b"
            ></div>
          </div>

          <div
            class="absolute bottom-1 flex items-center justify-center space-x-1"
          >
            <button
              @click="decrementCardCount(item.card.id)"
              class="w-6 h-6 sm:w-8 sm:h-8 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center leading-none transition duration-200"
            >
              －
            </button>
            <span
              class="w-6 h-6 sm:w-8 sm:h-8 font-bold text-center flex items-center justify-center"
              >{{ item.count }}</span
            >
            <button
              @click="incrementCardCount(item.card.id)"
              class="w-6 h-6 sm:w-8 sm:h-8 bg-green-600 hover:bg-green-700 text-white rounded-full flex items-center justify-center leading-none transition duration-200"
              :disabled="item.count >= 4 || totalDeckCards >= 60"
            >
              ＋
            </button>
          </div>
        </div>
        <div
          v-if="deckCards.length === 0"
          class="col-span-full text-center text-gray-400 mt-4 text-sm"
        >
          デッキにカードがありません。<br />下の一覧からカードをタップして追加してください。
        </div>
      </div>
    </div>

    <!-- カード一覧セクション -->
    <div class="flex flex-col flex-grow h-1/2 p-2 overflow-hidden">
      <div class="flex items-center justify-between mb-2 px-2">
        <h2 class="text-lg font-semibold">カード一覧</h2>
        <button
          @click="openFilterModal"
          class="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition duration-200"
          title="フィルター・検索"
        >
          検索/絞り込み
        </button>
      </div>

      <div
        class="flex-grow overflow-y-auto grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 p-2 bg-gray-700 rounded"
      >
        <div
          v-if="isLoading"
          class="col-span-full text-center text-gray-400 mt-4 text-sm"
        >
          カードデータを読み込み中...
        </div>
        <div
          v-else-if="error"
          class="col-span-full text-center text-red-400 mt-4 text-sm"
        >
          エラー: {{ error }}
        </div>
        <div
          v-else-if="sortedAndFilteredAvailableCards.length === 0"
          class="col-span-full text-center text-gray-400 mt-4 text-sm"
        >
          条件に一致するカードが見つかりません。
        </div>
        <div
          v-else
          v-for="card in sortedAndFilteredAvailableCards"
          :key="card.id"
          class="flex flex-col items-center cursor-pointer transition duration-200"
          @click="addCardToDeck(card)"
          title="デッキに追加"
        >
          <div class="w-full">
            <img
              :src="getCardImageUrl(card.id)"
              @error="handleImageError"
              :alt="card.name"
              class="block w-full h-full object-cover rounded"
            />
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
