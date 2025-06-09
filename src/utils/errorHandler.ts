import {
  ok,
  err,
  type Result,
  fromThrowable,
  fromAsyncThrowable,
} from "neverthrow";
import { logger } from "./logger";
import { ERROR_MESSAGES } from "../constants";

// エラー型の定義
export type AppError =
  | {
      readonly type: "validation";
      readonly message: string;
      readonly details?: unknown;
    }
  | {
      readonly type: "runtime";
      readonly message: string;
      readonly originalError: unknown;
    }
  | {
      readonly type: "async";
      readonly message: string;
      readonly originalError: unknown;
    }
  | {
      readonly type: "unknown";
      readonly message: string;
      readonly originalError: unknown;
    };

// エラーメッセージを統一的に作成する純粋関数
export const createErrorMessage = (
  baseMessage: string,
  error: unknown
): string => {
  if (!baseMessage) {
    return ERROR_MESSAGES.VALIDATION.BASE_MESSAGE_NOT_PROVIDED;
  }

  const errorMessage = error instanceof Error ? error.message : String(error);
  return `${baseMessage}: ${errorMessage}`;
};

// エラーログを記録する関数
export const logError = (baseMessage: string, error: unknown): void => {
  logger.error(baseMessage, error);
};

// トーストメッセージを表示する関数型
export type ShowToastFunction = (message: string) => void;

// エラーハンドリング関数を関数型で実装
export const createErrorHandler = (showToast?: ShowToastFunction) => {
  return {
    // バリデーションエラーを処理
    handleValidationError: (
      message: string,
      details?: unknown
    ): Result<never, AppError> => {
      const error: AppError = { type: "validation", message, details };
      logError(message, details);
      if (showToast) {
        showToast(`${message}。`);
      }
      return err(error);
    },

    // ランタイムエラーを処理
    handleRuntimeError: (
      baseMessage: string,
      originalError: unknown
    ): Result<never, AppError> => {
      const fullMessage = createErrorMessage(baseMessage, originalError);
      const error: AppError = {
        type: "runtime",
        message: fullMessage,
        originalError,
      };
      logError(baseMessage, originalError);
      if (showToast) {
        showToast(`${baseMessage}。`);
      }
      return err(error);
    },

    // 非同期エラーを処理
    handleAsyncError: (
      baseMessage: string,
      originalError: unknown
    ): Result<never, AppError> => {
      const fullMessage = createErrorMessage(baseMessage, originalError);
      const error: AppError = {
        type: "async",
        message: fullMessage,
        originalError,
      };
      logError(baseMessage, originalError);
      if (showToast) {
        showToast(`${baseMessage}。`);
      }
      return err(error);
    },
  };
};

// デフォルトエラーハンドラー
export const defaultErrorHandler = createErrorHandler();

/**
 * 同期操作を安全に実行するヘルパー関数
 */
export const safeSyncOperation = <T>(
  operation: () => T,
  errorMessage: string,
  showToast?: ShowToastFunction
): Result<T, AppError> => {
  if (!operation) {
    const handler = createErrorHandler(showToast);
    return handler.handleValidationError(
      ERROR_MESSAGES.VALIDATION.OPERATION_NOT_PROVIDED
    );
  }

  if (!errorMessage) {
    const handler = createErrorHandler(showToast);
    return handler.handleValidationError(
      ERROR_MESSAGES.VALIDATION.ERROR_MESSAGE_NOT_PROVIDED
    );
  }

  const safeOperation = fromThrowable(operation, (error: unknown) => error);
  const result = safeOperation();

  if (result.isErr()) {
    const handler = createErrorHandler(showToast);
    return handler.handleRuntimeError(errorMessage, result.error);
  }

  return ok(result.value);
};

/**
 * 非同期操作を安全に実行するヘルパー関数
 */
export const safeAsyncOperation = async <T>(
  operation: () => Promise<T>,
  errorMessage: string,
  showToast?: ShowToastFunction
): Promise<Result<T, AppError>> => {
  if (!operation) {
    const handler = createErrorHandler(showToast);
    return handler.handleValidationError(
      ERROR_MESSAGES.VALIDATION.OPERATION_NOT_PROVIDED
    );
  }

  if (!errorMessage) {
    const handler = createErrorHandler(showToast);
    return handler.handleValidationError(
      ERROR_MESSAGES.VALIDATION.ERROR_MESSAGE_NOT_PROVIDED
    );
  }

  const safeAsyncOp = fromAsyncThrowable(operation, (error: unknown) => error);
  const result = await safeAsyncOp();

  if (result.isErr()) {
    const handler = createErrorHandler(showToast);
    return handler.handleAsyncError(errorMessage, result.error);
  }

  return ok(result.value);
};

// エラー情報を文字列に変換する純粋関数
export const errorToString = (error: AppError): string => {
  switch (error.type) {
    case "validation":
      return `検証エラー: ${error.message}`;
    case "runtime":
      return `実行時エラー: ${error.message}`;
    case "async":
      return `非同期エラー: ${error.message}`;
    case "unknown":
      return `不明なエラー: ${error.message}`;
  }
};

// 複数のエラーを結合する純粋関数
export const combineErrors = (errors: readonly AppError[]): AppError => {
  if (errors.length === 0) {
    return {
      type: "unknown",
      message: "エラーが発生しました",
      originalError: null,
    };
  }

  if (errors.length === 1) {
    return errors[0];
  }

  const messages = errors.map(errorToString).join("; ");
  return {
    type: "unknown",
    message: `複数のエラーが発生しました: ${messages}`,
    originalError: errors,
  };
};

// レガシー関数（下位互換性のため）
export const handleError = (
  baseMessage: string,
  error: unknown,
  showErrorFunc?: ShowToastFunction
): Result<string, { message: string }> => {
  const handler = createErrorHandler(showErrorFunc);
  const result = handler.handleRuntimeError(baseMessage, error);

  if (result.isErr()) {
    return err({ message: result.error.message });
  }

  return ok(baseMessage);
};
