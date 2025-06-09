/**
 * ログレベルの定義
 */
export const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
} as const;

type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

/**
 * ログレベルに応じてログを出力するかどうかを判定
 */
const shouldLog = (level: LogLevel): boolean => {
  const isDevelopment = import.meta.env.DEV;

  if (isDevelopment) {
    return true; // 開発環境では全てのログを出力
  }

  // 本番環境では警告とエラーのみ出力
  return level >= LogLevel.WARN;
};

/**
 * デバッグログ（開発環境でのみ出力）
 */
export const debug = (message: string, ...args: any[]): void => {
  if (!shouldLog(LogLevel.DEBUG)) {
    return;
  }

  console.log(`[DEBUG] ${message}`, ...args);
};

/**
 * 情報ログ（開発環境でのみ出力）
 */
export const info = (message: string, ...args: any[]): void => {
  if (!shouldLog(LogLevel.INFO)) {
    return;
  }

  console.info(`[INFO] ${message}`, ...args);
};

/**
 * 警告ログ
 */
export const warn = (message: string, ...args: any[]): void => {
  if (!shouldLog(LogLevel.WARN)) {
    return;
  }

  console.warn(`[WARN] ${message}`, ...args);
};

/**
 * エラーログ
 */
export const error = (message: string, ...args: any[]): void => {
  if (!shouldLog(LogLevel.ERROR)) {
    return;
  }

  console.error(`[ERROR] ${message}`, ...args);
};

/**
 * ロガー関数をまとめたオブジェクト
 * 既存コードとの互換性のため
 */
export const logger = {
  debug,
  info,
  warn,
  error,
} as const;
