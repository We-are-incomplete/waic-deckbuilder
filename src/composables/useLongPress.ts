import { ref, onBeforeUnmount, readonly, computed } from "vue";
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
  | { readonly type: "timerError"; readonly message: string };

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
      return {
        type: "cancelled",
        duration: 0,
      };
    default:
      return { type: "timeout" };
  }
};

/**
 * 長押し機能を提供するコンポーザブル関数
 */
export const useLongPress = (options: LongPressOptions = {}) => {
  const { delay: inputDelay, onLongPress, onPress, onCancel } = options;

  // 遅延の検証
  const defaultDelay = getDefaultDelay();
  const delayResult = validateDelay(inputDelay ?? defaultDelay);
  const delay = delayResult.isOk() ? delayResult.value : defaultDelay;

  // 状態管理
  const pressState = ref<PressState>({ type: "idle" });
  let pressTimer: ReturnType<typeof setTimeout> | null = null;
  let lastResult: LongPressResult | null = null;

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
        pressState.value = { type: "longPressed", pressTime };
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
    pressState.value = { type: "pressing", startTime };

    // 長押しタイマーを開始
    const timerResult = startLongPressTimer(startTime);
    if (timerResult.isErr()) {
      console.warn("長押しタイマーの開始に失敗しました:", timerResult.error);
      pressState.value = { type: "cancelled" };
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
    lastResult = createPressResult(currentState, endTime);

    // コールバック実行
    switch (lastResult.type) {
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
    pressState.value = { type: "idle" };
  };

  /**
   * プレスキャンセル処理
   */
  const cancelPress = (): void => {
    clearTimer();
    pressState.value = { type: "cancelled" };
    lastResult = { type: "cancelled", duration: 0 };
    onCancel?.();
  };

  /**
   * 現在の状態情報を取得
   */
  const getStateInfo = () => {
    const state = pressState.value;
    const currentTime = getCurrentTime();

    switch (state.type) {
      case "pressing":
        return {
          isPressing: true,
          isLongPressed: false,
          currentDuration: currentTime - state.startTime,
          progress: Math.min((currentTime - state.startTime) / delay, 1),
        };
      case "longPressed":
        return {
          isPressing: false,
          isLongPressed: true,
          currentDuration: state.pressTime,
          progress: 1,
        };
      default:
        return {
          isPressing: false,
          isLongPressed: false,
          currentDuration: 0,
          progress: 0,
        };
    }
  };

  /**
   * 最後の操作結果を取得
   */
  const getLastResult = () => lastResult;

  // クリーンアップ
  onBeforeUnmount(() => {
    clearTimer();
  });

  return {
    // リアクティブな状態
    pressState: readonly(pressState),

    // アクション
    startPress,
    endPress,
    cancelPress,

    // ユーティリティ
    getStateInfo,
    getLastResult,

    // 設定値
    delay: readonly(ref(delay)),

    // 計算プロパティ
    isPressing: readonly(computed(() => pressState.value.type === "pressing")),
    isLongPressed: readonly(
      computed(() => pressState.value.type === "longPressed")
    ),
  };
};
