import { logger } from "./logger";

/**
 * エラーを統一的に処理するヘルパー関数
 * @param baseMessage 基本エラーメッセージ
 * @param error エラーオブジェクト
 * @param showErrorFunc トースト表示用関数（オプション）
 * @returns フォーマットされたエラーメッセージ
 */
export function handleError(
  baseMessage: string,
  error: unknown,
  showErrorFunc?: (message: string) => void
): string {
  const fullMessage = `${baseMessage}: ${
    error instanceof Error ? error.message : String(error)
  }`;

  logger.error(baseMessage, error);

  if (showErrorFunc) {
    showErrorFunc(baseMessage + "。");
  }

  return fullMessage;
}

/**
 * 非同期操作を安全に実行するヘルパー関数
 * @param operation 実行する非同期操作
 * @param errorMessage エラー時のメッセージ
 * @param showErrorFunc トースト表示用関数（オプション）
 * @returns 成功時はtrue、失敗時はfalse
 */
export async function safeAsyncOperation(
  operation: () => Promise<void>,
  errorMessage: string,
  showErrorFunc?: (message: string) => void
): Promise<boolean> {
  try {
    await operation();
    return true;
  } catch (error) {
    handleError(errorMessage, error, showErrorFunc);
    return false;
  }
}
