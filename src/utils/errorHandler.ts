import { err, ok, Result, fromThrowable, fromAsyncThrowable } from "neverthrow";
import { logger } from "./logger";

// エラーの種類を定義
export type AppError = {
  type: "validation" | "runtime" | "async";
  message: string;
  details?: unknown;
  originalError?: unknown;
};

// エラーメッセージの定数
export const ERROR_MESSAGES = {
  VALIDATION: {
    OPERATION_NOT_PROVIDED: "操作が提供されていません",
    ERROR_MESSAGE_NOT_PROVIDED: "エラーメッセージが提供されていません",
  },
} as const;

// エラーハンドラーインターフェース
export interface ErrorHandler {
  handleValidationError: (message: string, details?: unknown) => Result<never, AppError>;
  handleRuntimeError: (baseMessage: string, originalError: unknown) => Result<never, AppError>;
  handleAsyncError: (baseMessage: string, originalError: unknown) => Result<never, AppError>;
}

// ログ出力関数
const logError = (message: string, error?: unknown): void => {
  if (error) {
    logger.error(message, error);
  } else {
    logger.error(message);
  }
};

// エラーメッセージを作成するヘルパー関数
const createErrorMessage = (baseMessage: string, error: unknown): string => {
  if (error instanceof Error) {
    return `${baseMessage}: ${error.message}`;
  }
  if (typeof error === "string") {
    return `${baseMessage}: ${error}`;
  }
  return baseMessage;
};

// エラーハンドリング関数を関数型で実装
export const createErrorHandler = () => {
  return {
    // バリデーションエラーを処理
    handleValidationError: (message: string, details?: unknown): Result<never, AppError> => {
      const error: AppError = { type: "validation", message, details };
      logError(message, details);
      return err(error);
    },

    // ランタイムエラーを処理
    handleRuntimeError: (baseMessage: string, originalError: unknown): Result<never, AppError> => {
      const fullMessage = createErrorMessage(baseMessage, originalError);
      const error: AppError = {
        type: "runtime",
        message: fullMessage,
        originalError,
      };
      logError(baseMessage, originalError);
      return err(error);
    },

    // 非同期エラーを処理
    handleAsyncError: (baseMessage: string, originalError: unknown): Result<never, AppError> => {
      const fullMessage = createErrorMessage(baseMessage, originalError);
      const error: AppError = {
        type: "async",
        message: fullMessage,
        originalError,
      };
      logError(baseMessage, originalError);
      return err(error);
    },
  };
};

/**
 * 同期操作を安全に実行するヘルパー関数
 */
export const safeSyncOperation = <T>(
  operation: () => T,
  errorMessage: string,
): Result<T, AppError> => {
  if (!operation) {
    const handler = createErrorHandler();
    return handler.handleValidationError(ERROR_MESSAGES.VALIDATION.OPERATION_NOT_PROVIDED);
  }

  if (!errorMessage) {
    const handler = createErrorHandler();
    return handler.handleValidationError(ERROR_MESSAGES.VALIDATION.ERROR_MESSAGE_NOT_PROVIDED);
  }

  const safeOperation = fromThrowable(operation, (error: unknown) => error);
  const result = safeOperation();

  if (result.isErr()) {
    const handler = createErrorHandler();
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
): Promise<Result<T, AppError>> => {
  if (!operation) {
    const handler = createErrorHandler();
    return handler.handleValidationError(ERROR_MESSAGES.VALIDATION.OPERATION_NOT_PROVIDED);
  }

  if (!errorMessage) {
    const handler = createErrorHandler();
    return handler.handleValidationError(ERROR_MESSAGES.VALIDATION.ERROR_MESSAGE_NOT_PROVIDED);
  }

  const safeAsyncOp = fromAsyncThrowable(operation, (error: unknown) => error);
  const result = await safeAsyncOp();

  if (result.isErr()) {
    const handler = createErrorHandler();
    return handler.handleAsyncError(errorMessage, result.error);
  }

  return ok(result.value);
};
