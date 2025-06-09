/**
 * エラーメッセージの定数定義
 * 将来的な国際化対応を考慮した構造
 */
export const ERROR_MESSAGES = {
  VALIDATION: {
    BASE_MESSAGE_NOT_PROVIDED: "ベースメッセージが指定されていません",
    OPERATION_NOT_PROVIDED: "操作が指定されていません",
    ERROR_MESSAGE_NOT_PROVIDED: "エラーメッセージが指定されていません",
  },
} as const;
