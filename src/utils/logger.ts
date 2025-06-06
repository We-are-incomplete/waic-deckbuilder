/**
 * ログレベルの定義
 */
export const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
} as const;

export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

/**
 * ロガークラス
 * 開発環境でのみデバッグ・情報ログを出力し、本番環境では警告・エラーログのみ出力
 */
class Logger {
  private isDevelopment = import.meta.env.DEV;

  /**
   * ログレベルに応じてログを出力するかどうかを判定
   */
  private shouldLog(level: LogLevel): boolean {
    if (this.isDevelopment) {
      return true; // 開発環境では全てのログを出力
    }
    // 本番環境では警告とエラーのみ出力
    return level >= LogLevel.WARN;
  }

  /**
   * デバッグログ（開発環境でのみ出力）
   */
  debug(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }

  /**
   * 情報ログ（開発環境でのみ出力）
   */
  info(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(`[INFO] ${message}`, ...args);
    }
  }

  /**
   * 警告ログ
   */
  warn(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  /**
   * エラーログ
   */
  error(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }
}

/**
 * ロガーのシングルトンインスタンス
 */
export const logger = new Logger();
