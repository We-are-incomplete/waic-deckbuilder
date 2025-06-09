import { ok, err, type Result } from "neverthrow";
import { logger } from "./logger";

/**
 * エラーを統一的に処理するヘルパー関数
 * @param baseMessage 基本エラーメッセージ
 * @param error エラーオブジェクト
 * @param showErrorFunc トースト表示用関数（オプション）
 */
export function handleError(
  baseMessage: string,
  error: unknown,
  showErrorFunc?: (message: string) => void
): void {
  if (!baseMessage) {
    logger.error("ベースメッセージが指定されていません", error);
    return;
  }

  const fullMessage = `${baseMessage}: ${
    error instanceof Error ? error.message : String(error)
  }`;

  logger.error(baseMessage, error);

  if (showErrorFunc) {
    showErrorFunc(fullMessage);
  }
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
    handleError(errorMessage, caughtError, showErrorFunc);
    return err({ message: errorMessage, originalError: caughtError });
  }
}
