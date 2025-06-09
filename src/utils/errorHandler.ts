import { ok, err, type Result } from "neverthrow";
import { logger } from "./logger";

/**
 * エラーを統一的に処理するヘルパー関数
 * @param baseMessage 基本エラーメッセージ
 * @param error エラーオブジェクト
 * @param showErrorFunc トースト表示用関数（オプション）
 * @returns 成功時はフォーマットされたエラーメッセージ、失敗時はエラー情報
 */
export function handleError(
  baseMessage: string,
  error: unknown,
  showErrorFunc?: (message: string) => void
): Result<string, { message: string; originalError: unknown }> {
  if (!baseMessage) {
    return err({
      message: "ベースメッセージが指定されていません",
      originalError: error,
    });
  }

  const fullMessage = `${baseMessage}: ${
    error instanceof Error ? error.message : String(error)
  }`;

  logger.error(baseMessage, error);

  if (showErrorFunc) {
    showErrorFunc(baseMessage + "。");
  }

  return ok(fullMessage);
}

/**
 * 非同期操作を安全に実行するヘルパー関数
 * @param operation 実行する非同期操作
 * @param errorMessage エラー時のメッセージ
 * @param showErrorFunc トースト表示用関数（オプション）
 * @returns 成功時はok(void)、失敗時はerr(エラー情報)
 */
export async function safeAsyncOperation(
  operation: () => Promise<void>,
  errorMessage: string,
  showErrorFunc?: (message: string) => void
): Promise<Result<void, { message: string; originalError: unknown }>> {
  if (!operation) {
    return err({ message: "操作が指定されていません", originalError: null });
  }

  if (!errorMessage) {
    return err({
      message: "エラーメッセージが指定されていません",
      originalError: null,
    });
  }

  try {
    await operation();
    return ok(undefined);
  } catch (caughtError) {
    const errorResult = handleError(errorMessage, caughtError, showErrorFunc);
    if (errorResult.isErr()) {
      return err(errorResult.error);
    }
    return err({ message: errorResult.value, originalError: caughtError });
  }
}
