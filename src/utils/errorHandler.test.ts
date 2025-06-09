import { describe, it, expect, vi } from "vitest";
import { handleError, safeAsyncOperation } from "./errorHandler";
import { ERROR_MESSAGES } from "../constants";

describe("errorHandler", () => {
  describe("handleError", () => {
    it("成功時にエラーメッセージを返す", () => {
      const showErrorFunc = vi.fn();
      const result = handleError(
        "テストエラー",
        new Error("詳細エラー"),
        showErrorFunc
      );

      if (result.isErr()) {
        throw new Error("unreachable");
      }

      expect(result.value).toBe("テストエラー: 詳細エラー");
      expect(showErrorFunc).toHaveBeenCalledWith("テストエラー。");
    });

    it("ベースメッセージが空の場合にエラーを返す", () => {
      const result = handleError("", new Error("テストエラー"));

      if (result.isOk()) {
        throw new Error("unreachable");
      }

      expect(result.error.message).toBe(
        ERROR_MESSAGES.VALIDATION.BASE_MESSAGE_NOT_PROVIDED
      );
    });

    it("Error以外のエラーも処理できる", () => {
      const result = handleError("テストエラー", "文字列エラー");

      if (result.isErr()) {
        throw new Error("unreachable");
      }

      expect(result.value).toBe("テストエラー: 文字列エラー");
    });
  });

  describe("safeAsyncOperation", () => {
    it("正常な非同期操作を実行する", async () => {
      const operation = vi.fn().mockResolvedValue(undefined);
      const result = await safeAsyncOperation(operation, "テストエラー");

      if (result.isErr()) {
        throw new Error("unreachable");
      }

      expect(operation).toHaveBeenCalled();
    });

    it("操作が指定されていない場合にエラーを返す", async () => {
      // @ts-expect-error 意図的にnullを渡している
      const result = await safeAsyncOperation(null, "テストエラー");

      if (result.isOk()) {
        throw new Error("unreachable");
      }

      expect(result.error.message).toBe(
        ERROR_MESSAGES.VALIDATION.OPERATION_NOT_PROVIDED
      );
    });

    it("エラーメッセージが指定されていない場合にエラーを返す", async () => {
      const operation = vi.fn();
      const result = await safeAsyncOperation(operation, "");

      if (result.isOk()) {
        throw new Error("unreachable");
      }

      expect(result.error.message).toBe(
        ERROR_MESSAGES.VALIDATION.ERROR_MESSAGE_NOT_PROVIDED
      );
    });

    it("非同期操作でエラーが発生した場合にエラーを返す", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("非同期エラー"));
      const showErrorFunc = vi.fn();
      const result = await safeAsyncOperation(
        operation,
        "テストエラー",
        showErrorFunc
      );

      if (result.isOk()) {
        throw new Error("unreachable");
      }

      expect(result.error.message).toBe("テストエラー: 非同期エラー");
      expect(showErrorFunc).toHaveBeenCalledWith("テストエラー。");
    });
  });
});
