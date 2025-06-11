import {
  onBeforeUnmount,
  readonly,
  computed,
  shallowRef,
  triggerRef,
} from "vue";
import { ok, err, type Result } from "neverthrow";

// 長押しの状態を表現する代数的データ型
type PressState =
  | { readonly type: "idle" }
  | { readonly type: "pressing"; readonly startTime: number }
  | { readonly type: "longPressed"; readonly pressTime: number }
  | { readonly type: "cancelled" };

// 長押しオプションの型
interface LongPressOptions {
  readonly delay?: number;
  readonly onLongPress?: () => void;
  readonly onPress?: () => void;
  readonly onCancel?: () => void;
}

// 長押し結果の型
type LongPressResult =
  | { readonly type: "press"; readonly duration: number }
  | { readonly type: "longPress"; readonly duration: number }
  | { readonly type: "cancelled"; readonly duration: number }
  | { readonly type: "timeout" };

// エラー型
type LongPressError =
  | { readonly type: "invalidDelay"; readonly value: number }
  | { readonly type: "timerError"; readonly message: string }; // messageプロパティを追加

/**
 * 遅延値を検証する純粋関数
 */
const validateDelay = (delay: number): Result<number, LongPressError> => {
  if (!Number.isFinite(delay) || delay < 0) {
    return err({ type: "invalidDelay", value: delay });
  }
  return ok(delay);
};

/**
 * ユーザーエージェントからデフォルト遅延を決定する純粋関数
 */
const getDefaultDelay = (): number => {
  if (typeof window !== "undefined") {
    // タッチデバイスの検出
    const isTouchDevice =
      "ontouchstart" in window || navigator.maxTouchPoints > 0;
    return isTouchDevice ? 400 : 500;
  }
  return 500;
};

/**
 * 現在時刻を取得する純粋関数（テスト可能性のため分離）
 */
const getCurrentTime = (): number => Date.now();

/**
 * プレス結果を作成する純粋関数
 */
const createPressResult = (
  state: PressState,
  endTime: number
): LongPressResult => {
  switch (state.type) {
    case "pressing":
      return {
        type: "press",
        duration: endTime - state.startTime,
      };
    case "longPressed":
      return {
        type: "longPress",
        duration: state.pressTime,
      };
    case "cancelled":
      // キャンセルされた時点でのdurationを反映させるため、endTimeを使用
      // ただし、cancelled状態にはstartTimeがないため、0とするか、
      // 呼び出し元で計算して渡す必要がある。ここではシンプルに0を維持。
      return {
        type: "cancelled",
        duration: 0, // durationは呼び出し元で計算されるべきだが、ここではシンプルに0
      };
    case "idle": // idle状態からendPressが呼ばれた場合
      return { type: "timeout" }; // durationは計算できないためtimeoutとする
  }
};

/**
 * Vue 3.5最適化: 長押し機能を提供するコンポーザブル関数
 */
export const useLongPress = (options: LongPressOptions = {}) => {
  const { delay: inputDelay, onLongPress, onPress, onCancel } = options;

  // 遅延の検証
  const defaultDelay = getDefaultDelay();
  const delayResult = validateDelay(inputDelay ?? defaultDelay);
  const delay = delayResult.isOk() ? delayResult.value : defaultDelay;

  // Vue 3.5の新機能: shallowRef for performance optimization
  // 状態オブジェクトの深い監視は不要なためshallowRefを使用
  const pressState = shallowRef<PressState>({ type: "idle" });
  let pressTimer: ReturnType<typeof setTimeout> | null = null;

  // Vue 3.5の新機能: shallowRef for result state
  const lastResult = shallowRef<LongPressResult | null>(null);

  /**
   * Vue 3.5最適化: 効率的な状態更新
   */
  const updatePressState = (newState: PressState): void => {
    pressState.value = newState;
    triggerRef(pressState); // 手動でリアクティブ更新をトリガー
  };

  /**
   * タイマーをクリアする純粋でない関数
   */
  const clearTimer = (): void => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
  };

  /**
   * 長押しタイマーを開始する
   */
  const startLongPressTimer = (
    startTime: number
  ): Result<void, LongPressError> => {
    try {
      pressTimer = setTimeout(() => {
        const pressTime = getCurrentTime() - startTime;
        updatePressState({ type: "longPressed", pressTime });
        onLongPress?.();
      }, delay);
      return ok(undefined);
    } catch (error) {
      return err({
        type: "timerError",
        message: error instanceof Error ? error.message : "タイマー設定エラー",
      });
    }
  };

  /**
   * プレス開始処理
   */
  const startPress = (event?: Event): void => {
    // コンテキストメニューを無効化
    if (event?.type === "contextmenu") {
      event.preventDefault();
    }

    // 既存のタイマーをクリア
    clearTimer();

    const startTime = getCurrentTime();
    updatePressState({ type: "pressing", startTime });

    // 長押しタイマーを開始
    const timerResult = startLongPressTimer(startTime);
    if (timerResult.isErr()) {
      console.warn(
        "長押しタイマーの開始に失敗しました:",
        timerResult.error.type,
        timerResult.error.type === "timerError"
          ? timerResult.error.message
          : "不明なエラー"
      );
      updatePressState({ type: "cancelled" });
      onCancel?.();
    }
  };

  /**
   * プレス終了処理
   */
  const endPress = (): void => {
    const endTime = getCurrentTime();
    const currentState = pressState.value;

    clearTimer();

    // 結果を作成
    const result = createPressResult(currentState, endTime);
    lastResult.value = result;
    triggerRef(lastResult);

    // コールバック実行
    switch (result.type) {
      case "press":
        onPress?.();
        break;
      case "longPress":
        // onLongPressは既にタイマーで実行済み
        break;
      case "cancelled":
        onCancel?.();
        break;
    }

    // 状態をリセット
    updatePressState({ type: "idle" });
  };

  /**
   * プレスキャンセル処理
   */
  const cancelPress = (): void => {
    clearTimer();
    updatePressState({ type: "cancelled" });
    // キャンセルされた場合、durationは0とする
    lastResult.value = { type: "cancelled", duration: 0 };
    triggerRef(lastResult);
    onCancel?.();
  };

  /**
   * Vue 3.5最適化: 現在の状態情報を取得
   */
  const getStateInfo = () => ({
    state: pressState.value.type,
    isIdle: pressState.value.type === "idle",
    isPressing: pressState.value.type === "pressing",
    isLongPressed: pressState.value.type === "longPressed",
    isCancelled: pressState.value.type === "cancelled",
    delay,
  });

  /**
   * Vue 3.5最適化: 最後の結果を取得
   */
  const getLastResult = () => lastResult.value;

  // Vue 3.5最適化: readonly computed for reactive state access
  const isActive = computed(() => pressState.value.type !== "idle");
  const isPressing = computed(() => pressState.value.type === "pressing");
  const isLongPressed = computed(() => pressState.value.type === "longPressed");

  // Vue 3.5の新機能: improved cleanup
  onBeforeUnmount(() => {
    clearTimer();
  });

  // イベントハンドラー群
  const eventHandlers = {
    // マウス/タッチイベント
    onMouseDown: startPress,
    onTouchStart: startPress,
    onMouseUp: endPress,
    onTouchEnd: endPress,
    onMouseLeave: cancelPress,
    onTouchCancel: cancelPress,

    // コンテキストメニュー無効化
    onContextMenu: (event: Event) => {
      event.preventDefault();
      return false;
    },
  } as const;

  return {
    // Vue 3.5最適化: readonly reactive state
    state: readonly(pressState),
    isActive: readonly(isActive),
    isPressing: readonly(isPressing),
    isLongPressed: readonly(isLongPressed),

    // Actions
    startPress,
    endPress,
    cancelPress,

    // Getters
    getStateInfo,
    getLastResult,

    // Event handlers for easy binding
    ...eventHandlers,
  };
};
