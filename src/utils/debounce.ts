import { ok, err, type Result } from "neverthrow";

/**
 * デバウンス関数を作成する（改善版）
 * @param func デバウンスする関数
 * @param delay 遅延時間（ミリ秒）
 * @returns 成功時はデバウンスされた関数とクリア関数、失敗時はエラー情報
 */
export function createDebounce<T extends (...args: any[]) => void>(
  func: T,
  delay: number
): Result<
  {
    debouncedFunc: T;
    clear: () => void;
    flush: () => void;
    pending: () => boolean;
  },
  string
> {
  if (!func) {
    return err("関数が指定されていません");
  }

  if (delay < 0) {
    return err("遅延時間は0以上で指定してください");
  }

  let timer: number | null = null;
  let lastArgs: Parameters<T> | null = null;

  const debouncedFunc = ((...args: Parameters<T>) => {
    lastArgs = args;

    if (timer !== null) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      try {
        if (lastArgs) {
          func(...lastArgs);
        }
      } catch (error) {
        console.error("デバウンス関数の実行中にエラーが発生しました:", error);
      } finally {
        timer = null;
        lastArgs = null;
      }
    }, delay);
  }) as T;

  const clear = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
      lastArgs = null;
    }
  };

  const flush = () => {
    if (timer !== null && lastArgs !== null) {
      clearTimeout(timer);
      try {
        func(...lastArgs);
      } catch (error) {
        console.error(
          "デバウンス関数のフラッシュ実行中にエラーが発生しました:",
          error
        );
      } finally {
        timer = null;
        lastArgs = null;
      }
    }
  };

  const pending = () => timer !== null;

  return ok({
    debouncedFunc,
    clear,
    flush,
    pending,
  });
}

/**
 * スロットル機能付きデバウンス（高頻度の更新に対応）
 */
export function createThrottledDebounce<T extends (...args: any[]) => void>(
  func: T,
  delay: number,
  maxWait?: number
): Result<
  {
    debouncedFunc: T;
    clear: () => void;
    flush: () => void;
    pending: () => boolean;
  },
  string
> {
  if (!func) {
    return err("関数が指定されていません");
  }

  if (delay < 0) {
    return err("遅延時間は0以上で指定してください");
  }

  if (maxWait !== undefined && maxWait < 0) {
    return err("最大待機時間は0以上で指定してください");
  }

  let timer: number | null = null;
  let throttleTimer: number | null = null;
  let lastArgs: Parameters<T> | null = null;
  let lastInvokeTime = 0;

  const invokeFunc = () => {
    if (lastArgs) {
      try {
        func(...lastArgs);
        lastInvokeTime = Date.now();
      } catch (error) {
        console.error(
          "スロットル・デバウンス関数の実行中にエラーが発生しました:",
          error
        );
      } finally {
        lastArgs = null;
      }
    }
  };

  const debouncedFunc = ((...args: Parameters<T>) => {
    lastArgs = args;
    const now = Date.now();

    // タイマーをクリア
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }

    // スロットル処理
    if (maxWait !== undefined) {
      const timeSinceLastInvoke = now - lastInvokeTime;

      if (timeSinceLastInvoke >= maxWait) {
        // 最大待機時間を超えた場合は即座に実行
        invokeFunc();
        return;
      }

      if (throttleTimer === null) {
        const remainingWait = maxWait - timeSinceLastInvoke;
        throttleTimer = setTimeout(() => {
          invokeFunc();
          throttleTimer = null;
        }, remainingWait);
      }
    }

    // 通常のデバウンス処理
    timer = setTimeout(() => {
      invokeFunc();
      timer = null;

      if (throttleTimer !== null) {
        clearTimeout(throttleTimer);
        throttleTimer = null;
      }
    }, delay);
  }) as T;

  const clear = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (throttleTimer !== null) {
      clearTimeout(throttleTimer);
      throttleTimer = null;
    }
    lastArgs = null;
  };

  const flush = () => {
    if ((timer !== null || throttleTimer !== null) && lastArgs !== null) {
      clear();
      invokeFunc();
    }
  };

  const pending = () => timer !== null || throttleTimer !== null;

  return ok({
    debouncedFunc,
    clear,
    flush,
    pending,
  });
}
