/**
 * @file エラーハンドリングユーティリティ
 * - 目的: アプリケーション全体のエラーを一元的に処理し、ログ記録と適切なエラー型への変換を行う。
 * - 方針: 例外は投げず Effect の Effect とエラーADTを使用する。
 */
import { Data, Effect } from "effect";
import { logger } from "./logger";

// エラーの種類を定義
export class AppError extends Data.TaggedError("AppError")<{
  readonly type: "ValidationError" | "RuntimeError" | "AsyncError";
  readonly message: string;
  readonly details?: unknown;
  readonly originalError?: unknown;
}> {}

// エラーメッセージの定数
export const ERROR_MESSAGES = {
  VALIDATION: {
    OPERATION_NOT_PROVIDED: "操作が提供されていません",
    ERROR_MESSAGE_NOT_PROVIDED: "エラーメッセージが提供されていません",
  },
} as const;

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
  // 共通のエラーハンドリングヘルパー
  const handleError = (
    type: AppError["type"], // AppErrorのtypeプロパティを使用
    baseMessage: string,
    originalError: unknown,
  ): Effect.Effect<never, AppError> => {
    const fullMessage = createErrorMessage(baseMessage, originalError);
    const error = new AppError({
      type: type,
      message: fullMessage,
      originalError,
    });
    logError(baseMessage, originalError);
    return Effect.fail(error);
  };

  return {
    // バリデーションエラーを処理
    handleValidationError: (
      message: string,
      details?: unknown,
    ): Effect.Effect<never, AppError> => {
      const error = new AppError({ type: "ValidationError", message, details });
      logError(message, details);
      return Effect.fail(error);
    },

    // ランタイムエラーを処理
    handleRuntimeError: (
      baseMessage: string,
      originalError: unknown,
    ): Effect.Effect<never, AppError> => {
      return handleError("RuntimeError", baseMessage, originalError);
    },

    // 非同期エラーを処理
    handleAsyncError: (
      baseMessage: string,
      originalError: unknown,
    ): Effect.Effect<never, AppError> => {
      return handleError("AsyncError", baseMessage, originalError);
    },
  };
};

// 共通のエラーハンドラーインスタンスを生成
const commonErrorHandler = createErrorHandler();

/**
 * 同期操作を安全に実行するヘルパー関数
 */
export const safeSyncOperation = <T>(
  operation: () => T,
  errorMessage: string,
): Effect.Effect<T, AppError> => {
  if (!operation) {
    return commonErrorHandler.handleValidationError(
      ERROR_MESSAGES.VALIDATION.OPERATION_NOT_PROVIDED,
    );
  }

  if (!errorMessage) {
    return commonErrorHandler.handleValidationError(
      ERROR_MESSAGES.VALIDATION.ERROR_MESSAGE_NOT_PROVIDED,
    );
  }

  return Effect.try({
    try: operation,
    catch: (error) => new AppError({ type: "RuntimeError", message: createErrorMessage(errorMessage, error), originalError: error }),
  });
};

/**
 * 非同期操作を安全に実行するヘルパー関数
 */
export const safeAsyncOperation = async <T>(
  operation: () => Promise<T>,
  errorMessage: string,
): Promise<Effect.Effect<T, AppError>> => {
  if (!operation) {
    return commonErrorHandler.handleValidationError(
      ERROR_MESSAGES.VALIDATION.OPERATION_NOT_PROVIDED,
    );
  }

  if (!errorMessage) {
    return commonErrorHandler.handleValidationError(
      ERROR_MESSAGES.VALIDATION.ERROR_MESSAGE_NOT_PROVIDED,
    );
  }

  return Effect.tryPromise({
    try: operation,
    catch: (error) => new AppError({ type: "AsyncError", message: createErrorMessage(errorMessage, error), originalError: error }),
  });
};
