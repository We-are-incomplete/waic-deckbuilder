/**
 * デバウンス関数を作成する
 * @param func デバウンスする関数
 * @param delay 遅延時間（ミリ秒）
 * @returns デバウンスされた関数とクリア関数
 */
export function createDebounce<T extends (...args: any[]) => void>(
  func: T,
  delay: number
): {
  debouncedFunc: T;
  clear: () => void;
} {
  let timer: number | null = null;

  const debouncedFunc = ((...args: Parameters<T>) => {
    if (timer !== null) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      func(...args);
      timer = null;
    }, delay);
  }) as T;

  const clear = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return {
    debouncedFunc,
    clear,
  };
}
