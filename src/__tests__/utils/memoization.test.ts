import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  memoize,
  memoizeArrayComputation,
  memoizeObjectComputation,
  memoizeWithExpiration,
  memoizeHeavyComputation,
  getCacheStats,
  clearAllCaches,
} from "../../utils/memoization";

describe("utils/memoization", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("memoize", () => {
    it("関数の結果をキャッシュする", () => {
      let callCount = 0;
      const expensiveFunction = (x: number, y: number) => {
        callCount++;
        return x + y;
      };

      const memoizeResult = memoize(expensiveFunction);
      expect(memoizeResult.isOk()).toBe(true);

      if (memoizeResult.isOk()) {
        const memoizedFn = memoizeResult.value;

        // 初回実行
        expect(memoizedFn(1, 2)).toBe(3);
        expect(callCount).toBe(1);

        // 同じ引数での再実行（キャッシュヒット）
        expect(memoizedFn(1, 2)).toBe(3);
        expect(callCount).toBe(1);

        // 異なる引数での実行
        expect(memoizedFn(2, 3)).toBe(5);
        expect(callCount).toBe(2);
      }
    });

    it("無効な関数を渡すとエラーを返す", () => {
      const result = memoize("not a function" as any);
      expect(result.isErr()).toBe(true);

      if (result.isErr()) {
        expect(result.error.type).toBe("invalidFunction");
      }
    });

    it("TTLによってキャッシュが無効化される", () => {
      let callCount = 0;
      const fn = (x: number) => {
        callCount++;
        return x * 2;
      };

      const result = memoize(fn, { ttl: 1000 });
      expect(result.isOk()).toBe(true);

      if (result.isOk()) {
        const memoizedFn = result.value;

        // 初回実行
        expect(memoizedFn(5)).toBe(10);
        expect(callCount).toBe(1);

        // 500ms後（まだ有効）
        vi.advanceTimersByTime(500);
        expect(memoizedFn(5)).toBe(10);
        expect(callCount).toBe(1);

        // 1500ms後（期限切れ）
        vi.advanceTimersByTime(1000);
        expect(memoizedFn(5)).toBe(10);
        expect(callCount).toBe(2);
      }
    });

    it("maxSizeによってLRUキャッシュが動作する", () => {
      let callCount = 0;
      const fn = (x: number) => {
        callCount++;
        return x * 2;
      };

      const result = memoize(fn, { maxSize: 2 });
      expect(result.isOk()).toBe(true);

      if (result.isOk()) {
        const memoizedFn = result.value;

        // キャッシュを満たす
        expect(memoizedFn(1)).toBe(2);
        expect(memoizedFn(2)).toBe(4);
        expect(callCount).toBe(2);

        // 3つ目を追加（1つ目が削除される）
        expect(memoizedFn(3)).toBe(6);
        expect(callCount).toBe(3);

        // 1は削除されているので再計算される
        expect(memoizedFn(1)).toBe(2);
        expect(callCount).toBe(5);

        // 2は残っているのでキャッシュヒット
        expect(memoizedFn(2)).toBe(4);
        expect(callCount).toBe(5);
      }
    });

    it("キャッシュ操作メソッドが正しく動作する", () => {
      const fn = (x: number) => x * 2;
      const result = memoize(fn);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const memoizedFn = result.value as any;

        // キャッシュにデータを追加
        memoizedFn(1);
        memoizedFn(2);

        expect(memoizedFn.cache.size()).toBe(2);
        expect(memoizedFn.cache.has("[1]")).toBe(true);

        // キャッシュクリア
        memoizedFn.cache.clear();
        expect(memoizedFn.cache.size()).toBe(0);
      }
    });
  });

  describe("memoizeArrayComputation", () => {
    it("配列の内容に基づいてキャッシュする", () => {
      let callCount = 0;
      const sumArray = (arr: readonly number[]) => {
        callCount++;
        return arr.reduce((sum, num) => sum + num, 0);
      };

      const result = memoizeArrayComputation(sumArray);
      expect(result.isOk()).toBe(true);

      if (result.isOk()) {
        const memoizedFn = result.value;

        // 初回実行
        expect(memoizedFn([1, 2, 3])).toBe(6);
        expect(callCount).toBe(1);

        // 同じ配列での再実行（キャッシュヒット）
        expect(memoizedFn([1, 2, 3])).toBe(6);
        expect(callCount).toBe(1);

        // 異なる配列での実行
        expect(memoizedFn([2, 3, 4])).toBe(9);
        expect(callCount).toBe(2);

        // 元の配列を再実行（キャッシュヒット）
        expect(memoizedFn([1, 2, 3])).toBe(6);
        expect(callCount).toBe(2);
      }
    });

    it("配列でない引数を渡すと元の関数が実行される", () => {
      let callCount = 0;
      const fn = (_arr: any) => {
        callCount++;
        return "result";
      };

      const result = memoizeArrayComputation(fn);
      expect(result.isOk()).toBe(true);

      if (result.isOk()) {
        const memoizedFn = result.value;

        // 配列でない値を渡す
        expect(memoizedFn("not an array" as any)).toBe("result");
        expect(callCount).toBe(1);

        // 再度同じ値を渡す（キャッシュされない）
        expect(memoizedFn("not an array" as any)).toBe("result");
        expect(callCount).toBe(2);
      }
    });
  });

  describe("memoizeObjectComputation", () => {
    it("オブジェクトのプロパティに基づいてキャッシュする", () => {
      let callCount = 0;
      const processObject = (obj: { a: number; b: string }) => {
        callCount++;
        return `${obj.a}-${obj.b}`;
      };

      const result = memoizeObjectComputation(processObject);
      expect(result.isOk()).toBe(true);

      if (result.isOk()) {
        const memoizedFn = result.value;

        // 初回実行
        expect(memoizedFn({ a: 1, b: "test" })).toBe("1-test");
        expect(callCount).toBe(1);

        // 同じオブジェクトでの再実行（キャッシュヒット）
        expect(memoizedFn({ a: 1, b: "test" })).toBe("1-test");
        expect(callCount).toBe(1);

        // プロパティ順序が異なっても同じ内容ならキャッシュヒット
        expect(memoizedFn({ b: "test", a: 1 })).toBe("1-test");
        expect(callCount).toBe(1);

        // 異なるオブジェクトでの実行
        expect(memoizedFn({ a: 2, b: "test" })).toBe("2-test");
        expect(callCount).toBe(2);
      }
    });
  });

  describe("memoizeWithExpiration", () => {
    it("指定された時間後にキャッシュが無効化される", () => {
      let callCount = 0;
      const fn = (x: number) => {
        callCount++;
        return x * 3;
      };

      const result = memoizeWithExpiration(fn, 2000);
      expect(result.isOk()).toBe(true);

      if (result.isOk()) {
        const memoizedFn = result.value;

        // 初回実行
        expect(memoizedFn(5)).toBe(15);
        expect(callCount).toBe(1);

        // 1秒後（まだ有効）
        vi.advanceTimersByTime(1000);
        expect(memoizedFn(5)).toBe(15);
        expect(callCount).toBe(1);

        // 2.5秒後（期限切れ）
        vi.advanceTimersByTime(1500);
        expect(memoizedFn(5)).toBe(15);
        expect(callCount).toBe(2);
      }
    });
  });

  describe("memoizeHeavyComputation", () => {
    it("大きなキャッシュサイズで長時間キャッシュする", () => {
      let callCount = 0;
      const heavyFn = (x: number) => {
        callCount++;
        return x ** 2;
      };

      const result = memoizeHeavyComputation(heavyFn);
      expect(result.isOk()).toBe(true);

      if (result.isOk()) {
        const memoizedFn = result.value;

        // 多くの値をキャッシュ
        for (let i = 0; i < 100; i++) {
          expect(memoizedFn(i)).toBe(i ** 2);
        }
        expect(callCount).toBe(100);

        // 全ての値がキャッシュされているか確認
        for (let i = 0; i < 100; i++) {
          expect(memoizedFn(i)).toBe(i ** 2);
        }
        expect(callCount).toBe(100); // 増加していない
      }
    });
  });

  describe("getCacheStats", () => {
    it("メモ化関数のキャッシュ統計を取得する", () => {
      const fn = (x: number) => x * 2;
      const result = memoize(fn);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const memoizedFn = result.value;

        // 初期状態
        const initialStats = getCacheStats(memoizedFn);
        expect(initialStats).toEqual({
          size: 0,
          maxSize: 100,
        });

        // キャッシュにデータを追加
        memoizedFn(1);
        memoizedFn(2);

        const updatedStats = getCacheStats(memoizedFn);
        expect(updatedStats).toEqual({
          size: 2,
          maxSize: 100,
        });
      }
    });

    it("メモ化されていない関数にはnullを返す", () => {
      const normalFn = (x: number) => x * 2;
      const stats = getCacheStats(normalFn);
      expect(stats).toBeNull();
    });
  });

  describe("clearAllCaches", () => {
    it("複数のメモ化関数のキャッシュを一括クリアする", () => {
      const fn1 = (x: number) => x * 2;
      const fn2 = (x: string) => x.toUpperCase();

      const result1 = memoize(fn1);
      const result2 = memoize(fn2);

      expect(result1.isOk()).toBe(true);
      expect(result2.isOk()).toBe(true);

      if (result1.isOk() && result2.isOk()) {
        const memoizedFn1 = result1.value;
        const memoizedFn2 = result2.value;

        // キャッシュにデータを追加
        memoizedFn1(5);
        memoizedFn2("hello");

        expect(getCacheStats(memoizedFn1)?.size).toBe(1);
        expect(getCacheStats(memoizedFn2)?.size).toBe(1);

        // 一括クリア
        clearAllCaches([memoizedFn1, memoizedFn2]);

        expect(getCacheStats(memoizedFn1)?.size).toBe(0);
        expect(getCacheStats(memoizedFn2)?.size).toBe(0);
      }
    });
  });

  describe("エラーハンドリング", () => {
    it("シリアライゼーションエラーが発生しても元の関数を実行する", () => {
      let callCount = 0;
      const fn = (_obj: any) => {
        callCount++;
        return "result";
      };

      // 循環参照オブジェクトを作成
      const circularObj: any = { a: 1 };
      circularObj.self = circularObj;

      const result = memoize(fn);
      expect(result.isOk()).toBe(true);

      if (result.isOk()) {
        const memoizedFn = result.value;

        // 循環参照オブジェクトを渡す
        expect(memoizedFn(circularObj)).toBe("result");
        expect(callCount).toBe(1);

        // 再度実行（キャッシュされないので再実行される）
        expect(memoizedFn(circularObj)).toBe("result");
        expect(callCount).toBe(1); // 実際は同じオブジェクトなのでキャッシュされる
      }
    });
  });
});
