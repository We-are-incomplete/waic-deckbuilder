import { ok, err, type Result } from "neverthrow";
import { logger } from "./logger";
import { ERROR_MESSAGES } from "../constants";

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
): Result<string, { message: string }> {
  if (!baseMessage) {
    const errorMessage = ERROR_MESSAGES.VALIDATION.BASE_MESSAGE_NOT_PROVIDED;
    logger.error(errorMessage, error);
    return err({ message: errorMessage });
  }

  const fullMessage = `${baseMessage}: ${
    error instanceof Error ? error.message : String(error)
  }`;

  logger.error(baseMessage, error);

  if (showErrorFunc) {
    showErrorFunc(`${baseMessage}。`);
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
    return err({
      message: ERROR_MESSAGES.VALIDATION.OPERATION_NOT_PROVIDED,
      originalError: null,
    });
  }

  if (!errorMessage) {
    return err({
      message: ERROR_MESSAGES.VALIDATION.ERROR_MESSAGE_NOT_PROVIDED,
      originalError: null,
    });
  }

  try {
    await operation();
    return ok(undefined);
  } catch (caughtError) {
    const errorResult = handleError(errorMessage, caughtError, showErrorFunc);
    const fullMessage = errorResult.isOk() ? errorResult.value : errorMessage;
    return err({ message: fullMessage, originalError: caughtError });
  }
}
