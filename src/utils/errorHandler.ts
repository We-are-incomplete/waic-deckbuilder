/**
 * @file エラーハンドリングユーティリティ
 * - 目的: アプリケーション全体のエラーを一元的に処理し、ログ記録と適切なエラー型への変換を行う。
 * - 方針: 例外は投げず Effect とエラーADTを使用する。
 */

import { DeckOperationError } from "../types/deck";

// エラーの種類を定義
export class AppError extends Error {
  readonly type: "ValidationError" | "RuntimeError" | "AsyncError";
  readonly details?: unknown;
  readonly originalError?: unknown;

  constructor(params: {
    type: "ValidationError" | "RuntimeError" | "AsyncError";
    message: string;
    details?: unknown;
    originalError?: unknown;
  }) {
    super(params.message);
    this.name = "AppError";
    this.type = params.type;
    this.details = params.details;
    this.originalError = params.originalError;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

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
    console.error(message, error);
  } else {
    console.error(message);
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
  try {
    return `${baseMessage}: ${JSON.stringify(error)}`;
  } catch {
    return `${baseMessage}: ${String(error)}`;
  }
};

// エラーハンドリング関数を関数型で実装
export const createErrorHandler = () => {
  return {
    // バリデーションエラーを処理
    handleValidationError: (message: string, details?: unknown): AppError => {
      const error = new AppError({ type: "ValidationError", message, details });
      logError(message, details);
      return error;
    },

    // ランタイムエラーを処理
    handleRuntimeError: (
      baseMessage: string,
      originalError: unknown,
    ): AppError => {
      const fullMessage = createErrorMessage(baseMessage, originalError);
      const error = new AppError({
        type: "RuntimeError",
        message: fullMessage,
        originalError,
      });
      logError(fullMessage, originalError);
      return error;
    },

    // 非同期エラーを処理
    handleAsyncError: (
      baseMessage: string,
      originalError: unknown,
    ): AppError => {
      const fullMessage = createErrorMessage(baseMessage, originalError);
      const error = new AppError({
        type: "AsyncError",
        message: fullMessage,
        originalError,
      });
      logError(fullMessage, originalError);
      return error;
    },
  };
};

/**
 * DeckOperationError をユーザーフレンドリーな文字列に変換する
 */
export const deckOperationErrorToString = (
  error: DeckOperationError,
): string => {
  switch (error.type) {
    case "CardNotFound":
      return `カードが見つかりません: ${error.cardId}`;
    case "MaxCountExceeded":
      return `最大枚数を超過しました: ${error.cardId} (最大: ${error.maxCount ?? "不明"})`;
    case "InvalidCardCount":
      return `不正なカード枚数です: ${error.cardId} (指定: ${error.count ?? "不明"})`;
    default:
      return `不明なエラー: ${"type" in (error as any) ? (error as any).type : String(error)}`;
  }
};

// 共通のエラーハンドラーインスタンスを生成
const commonErrorHandler = createErrorHandler();

/**
 * 同期操作を安全に実行するヘルパー関数
 */
export const safeSyncOperation = <T>(
  operation: () => T,
  errorMessage: string,
): T => {
  if (!operation) {
    const error = commonErrorHandler.handleValidationError(
      ERROR_MESSAGES.VALIDATION.OPERATION_NOT_PROVIDED,
    );
    throw error;
  }

  if (!errorMessage) {
    const error = commonErrorHandler.handleValidationError(
      ERROR_MESSAGES.VALIDATION.ERROR_MESSAGE_NOT_PROVIDED,
    );
    throw error;
  }

  try {
    return operation();
  } catch (error) {
    const appError = commonErrorHandler.handleRuntimeError(errorMessage, error);
    throw appError;
  }
};

export const safeAsyncOperation = async <T>(
  operation: () => Promise<T>,
  errorMessage: string,
): Promise<T> => {
  if (!operation) {
    const error = commonErrorHandler.handleValidationError(
      ERROR_MESSAGES.VALIDATION.OPERATION_NOT_PROVIDED,
    );
    throw error;
  }

  if (!errorMessage) {
    const error = commonErrorHandler.handleValidationError(
      ERROR_MESSAGES.VALIDATION.ERROR_MESSAGE_NOT_PROVIDED,
    );
    throw error;
  }

  try {
    return await operation();
  } catch (error) {
    const appError = commonErrorHandler.handleAsyncError(errorMessage, error);
    throw appError;
  }
};
