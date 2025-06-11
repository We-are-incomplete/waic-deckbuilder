import {
  ref,
  shallowRef,
  computed,
  markRaw,
  triggerRef,
  readonly,
  nextTick,
  type Ref,
} from "vue";

/**
 * 計算プロパティの依存関係を最小化
 */
export const useMinimalComputed = <T>(
  getter: () => T,
  deps: readonly Ref<unknown>[]
) => {
  const lastDepsValues = ref<unknown[]>([]);
  const cachedValue = shallowRef<T>();
  const hasCache = ref(false);

  const minimalComputed = computed(() => {
    // 依存関係の値を取得
    const currentDepsValues = deps.map((dep) => dep.value);

    // 依存関係が変わっていない場合はキャッシュを返す
    if (
      hasCache.value &&
      currentDepsValues.length === lastDepsValues.value.length &&
      currentDepsValues.every((val, idx) => val === lastDepsValues.value[idx])
    ) {
      return cachedValue.value as T;
    }

    // 新しい値を計算
    const newValue = getter();

    // キャッシュを更新
    lastDepsValues.value = currentDepsValues;
    cachedValue.value = newValue;
    hasCache.value = true;

    return newValue;
  });

  return minimalComputed;
};

/**
 * 遅延計算（使用時まで計算を遅延）
 */
export const useLazyComputed = <T>(
  getter: () => T,
  immediate: boolean = false,
  useNextTick: boolean = false
) => {
  const value = shallowRef<T>();
  const isComputed = ref(false);
  const isLoading = ref(false);

  const compute = async () => {
    if (isComputed.value) return value.value!;

    isLoading.value = true;
    if (useNextTick) {
      await nextTick();
    }

    try {
      value.value = getter();
      isComputed.value = true;
    } finally {
      isLoading.value = false;
    }

    return value.value!;
  };

  const reset = () => {
    value.value = undefined;
    isComputed.value = false;
    isLoading.value = false;
  };

  // 即座に計算する場合
  if (immediate) {
    compute();
  }

  return {
    value: computed(() => value.value),
    isComputed,
    isLoading,
    compute,
    reset,
  };
};

/**
 * バッチ更新の管理
 */
export const useBatchUpdates = () => {
  const pendingUpdates = markRaw(new Set<() => void>());
  const isScheduled = ref(false);

  const scheduleUpdate = (updateFn: () => void) => {
    pendingUpdates.add(updateFn);

    if (!isScheduled.value) {
      isScheduled.value = true;

      nextTick(() => {
        const updates = Array.from(pendingUpdates);
        pendingUpdates.clear();
        isScheduled.value = false;

        // 全ての更新を実行
        for (const update of updates) {
          try {
            update();
          } catch (error) {
            console.error("Batch update error:", error);
          }
        }
      });
    }
  };

  const flushUpdates = async () => {
    if (pendingUpdates.size === 0) return;

    const updates = Array.from(pendingUpdates);
    pendingUpdates.clear();
    isScheduled.value = false;

    await nextTick();

    for (const update of updates) {
      try {
        update();
      } catch (error) {
        console.error("Flush update error:", error);
      }
    }
  };

  return {
    scheduleUpdate,
    flushUpdates,
    pendingCount: computed(() => pendingUpdates.size),
  };
};

/**
 * 効率的なリスト管理
 */
export const useOptimizedList = <T>(
  initialItems: readonly T[] = [],
  keyExtractor: (item: T) => string = (item) => String(item)
) => {
  const items = shallowRef<readonly T[]>(initialItems);
  const keyToIndexMap = markRaw(new Map<string, number>());
  const indexToKeyMap = markRaw(new Map<number, string>());

  // インデックスマップを更新
  const updateMaps = () => {
    keyToIndexMap.clear();
    indexToKeyMap.clear();

    const itemList = items.value;
    for (let i = 0; i < itemList.length; i++) {
      const key = keyExtractor(itemList[i]);
      keyToIndexMap.set(key, i);
      indexToKeyMap.set(i, key);
    }
  };

  // 初期マップを構築
  updateMaps();

  const setItems = (newItems: readonly T[]) => {
    items.value = newItems;
    updateMaps();
    triggerRef(items);
  };

  const getItem = (key: string): T | undefined => {
    const index = keyToIndexMap.get(key);
    return index !== undefined ? items.value[index] : undefined;
  };

  const getIndex = (key: string): number | undefined => {
    return keyToIndexMap.get(key);
  };

  const getKey = (index: number): string | undefined => {
    return indexToKeyMap.get(index);
  };

  const hasItem = (key: string): boolean => {
    return keyToIndexMap.has(key);
  };

  return {
    items: readonly(items),
    setItems,
    getItem,
    getIndex,
    getKey,
    hasItem,
    length: computed(() => items.value.length),
  };
};

/**
 * メモリ効率的な文字列インターン
 */
export const useStringIntern = (
  maxSize: number = 1000,
  evictSize: number = 100
) => {
  const internPool = markRaw(new Map<string, string>());

  const intern = (str: string): string => {
    if (internPool.has(str)) {
      return internPool.get(str)!;
    }

    // メモリリーク防止のためサイズ制限
    if (internPool.size >= maxSize) {
      // 最初のevictSizeエントリを削除
      const keysToDelete = Array.from(internPool.keys()).slice(0, evictSize);
      for (const key of keysToDelete) {
        internPool.delete(key);
      }
    }

    internPool.set(str, str);
    return str;
  };

  const clear = () => internPool.clear();
  const size = () => internPool.size;

  return {
    intern,
    clear,
    size,
  };
};
