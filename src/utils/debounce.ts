import { ok, err, type Result } from "neverthrow";
import { logger } from "./logger";

/**
 * デバウンス関数を作成する（改善版）
 * @param func デバウンスする関数
 * @param delay 遅延時間（ミリ秒）
 * @returns 成功時はデバウンスされた関数とクリア関数、失敗時はエラー情報
 */
// デバウンス関数専用のエラー型
type DebounceError =
  | { readonly type: "invalidFunction"; readonly message: string }
  | { readonly type: "invalidDelay"; readonly message: string }
  | {
      readonly type: "execution";
      readonly message: string;
      readonly originalError: unknown;
    };

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
  DebounceError
> {
  if (!func) {
    return err({
      type: "invalidFunction",
      message: "関数が指定されていません",
    });
  }

  if (delay < 0) {
    return err({
      type: "invalidDelay",
      message: "遅延時間は0以上で指定してください",
    });
  }

  let timer: ReturnType<typeof setTimeout> | null = null; // 型定義を改善
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
        logger.error("デバウンス関数の実行中にエラーが発生しました:", error);
        // エラーを捕捉し、DebounceErrorとしてログ
        // ただし、デバウンス関数自体はResultを返さないため、ここではログのみ
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
        logger.error(
          "デバウンス関数のフラッシュ実行中にエラーが発生しました:",
          error
        );
        // エラーを捕捉し、DebounceErrorとしてログ
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
