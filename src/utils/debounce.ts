import { ok, err, type Result } from "neverthrow";

/**
 * デバウンス関数を作成する
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

  const debouncedFunc = ((...args: Parameters<T>) => {
    if (timer !== null) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      try {
        func(...args);
      } catch (error) {
        console.error("デバウンス関数の実行中にエラーが発生しました:", error);
      } finally {
        timer = null;
      }
    }, delay);
  }) as T;

  const clear = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return ok({
    debouncedFunc,
    clear,
  });
}
