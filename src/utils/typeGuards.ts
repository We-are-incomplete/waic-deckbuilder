import type { Card, DeckCard, FilterCriteria } from "../types";

/**
 * プリミティブ型のガード関数
 */
export const isString = (value: unknown): value is string => {
  return typeof value === "string";
};

export const isNumber = (value: unknown): value is number => {
  return (
    typeof value === "number" && !Number.isNaN(value) && Number.isFinite(value)
  );
};

export const isBoolean = (value: unknown): value is boolean => {
  return typeof value === "boolean";
};

export const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

export const isArray = <T>(
  value: unknown,
  itemGuard?: (item: unknown) => item is T
): value is T[] => {
  if (!Array.isArray(value)) return false;
  if (!itemGuard) return true;
  return value.every(itemGuard);
};

export const isNonEmptyString = (value: unknown): value is string => {
  return isString(value) && value.trim().length > 0;
};

export const isPositiveNumber = (value: unknown): value is number => {
  return isNumber(value) && value > 0;
};

export const isNonNegativeNumber = (value: unknown): value is number => {
  return isNumber(value) && value >= 0;
};

/**
 * 配列要素の型ガード
 */
export const isArrayOf = <T>(
  value: unknown,
  itemGuard: (item: unknown) => item is T
): value is T[] => {
  return Array.isArray(value) && value.every(itemGuard);
};

export const isNonEmptyArray = <T>(
  value: unknown,
  itemGuard?: (item: unknown) => item is T
): value is [T, ...T[]] => {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    (!itemGuard || value.every(itemGuard))
  );
};

/**
 * オプショナル値の型ガード
 */
export const isOptional = <T>(
  value: unknown,
  guard: (item: unknown) => item is T
): value is T | undefined => {
  return value === undefined || guard(value);
};

export const isNullable = <T>(
  value: unknown,
  guard: (item: unknown) => item is T
): value is T | null => {
  return value === null || guard(value);
};

export const isOptionalNullable = <T>(
  value: unknown,
  guard: (item: unknown) => item is T
): value is T | null | undefined => {
  return value === null || value === undefined || guard(value);
};

/**
 * カード関連の型ガード
 */
export const isCardId = (value: unknown): value is string => {
  return isNonEmptyString(value) && /^[a-zA-Z0-9_-]+$/.test(value);
};

export const isCardName = (value: unknown): value is string => {
  return isNonEmptyString(value) && value.length <= 100;
};

export const isCardKind = (value: unknown): value is string | number => {
  return isString(value) || isNumber(value);
};

export const isCardType = (
  value: unknown
): value is string | string[] | number => {
  return isString(value) || isNumber(value) || isArrayOf(value, isString);
};

export const isCardTags = (value: unknown): value is string | string[] => {
  return isString(value) || isArrayOf(value, isString);
};

export const isCard = (value: unknown): value is Card => {
  if (!isObject(value)) return false;

  const obj = value as Record<string, unknown>;

  return (
    isCardId(obj.id) &&
    isCardName(obj.name) &&
    isCardKind(obj.kind) &&
    isCardType(obj.type) &&
    isOptional(obj.tags, isCardTags) &&
    isOptional(obj.cost, isNonNegativeNumber) &&
    isOptional(obj.attack, isNonNegativeNumber) &&
    isOptional(obj.health, isNonNegativeNumber) &&
    isOptional(obj.description, isString) &&
    isOptional(obj.rarity, isString) &&
    isOptional(obj.set, isString)
  );
};

export const isCardArray = (value: unknown): value is Card[] => {
  return isArrayOf(value, isCard);
};

/**
 * デッキカード関連の型ガード
 */
export const isDeckCard = (value: unknown): value is DeckCard => {
  if (!isObject(value)) return false;

  const obj = value as Record<string, unknown>;

  return (
    isCard(obj.card) &&
    isPositiveNumber(obj.count) &&
    Number.isInteger(obj.count as number)
  );
};

export const isDeckCardArray = (value: unknown): value is DeckCard[] => {
  return isArrayOf(value, isDeckCard);
};

/**
 * フィルター関連の型ガード
 */
export const isFilterCriteria = (value: unknown): value is FilterCriteria => {
  if (!isObject(value)) return false;

  const obj = value as Record<string, unknown>;

  return (
    isString(obj.text) &&
    isArrayOf(obj.kind, isString) &&
    isArrayOf(obj.type, isString) &&
    isArrayOf(obj.tags, isString)
  );
};

/**
 * ユニオン型の型ガード
 */
export const isOneOf = <T extends readonly unknown[]>(
  value: unknown,
  guards: { [K in keyof T]: (v: unknown) => v is T[K] }
): value is T[number] => {
  return guards.some((guard) => guard(value));
};

/**
 * 複合条件の型ガード
 */
export const allOf = <T extends readonly unknown[]>(
  value: unknown,
  guards: { [K in keyof T]: (v: unknown) => v is T[K] }
): value is T[number] => {
  return guards.every((guard) => guard(value));
};

/**
 * レコード型の型ガード
 */
export const isRecord = <K extends string | number | symbol, V>(
  value: unknown,
  keyGuard: (key: unknown) => key is K,
  valueGuard: (value: unknown) => value is V
): value is Record<K, V> => {
  if (!isObject(value)) return false;

  for (const [key, val] of Object.entries(value)) {
    if (!keyGuard(key) || !valueGuard(val)) {
      return false;
    }
  }

  return true;
};

/**
 * 日付・時刻関連の型ガード
 */
export const isValidDate = (value: unknown): value is Date => {
  return value instanceof Date && !Number.isNaN(value.getTime());
};

export const isTimestamp = (value: unknown): value is number => {
  return isNumber(value) && value > 0 && Number.isInteger(value);
};

/**
 * URL・パス関連の型ガード
 */
export const isUrl = (value: unknown): value is string => {
  if (!isString(value)) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

export const isRelativePath = (value: unknown): value is string => {
  return isString(value) && !value.startsWith("http") && !value.startsWith("/");
};

/**
 * エラー関連の型ガード
 */
export const isError = (value: unknown): value is Error => {
  return value instanceof Error;
};

export const isErrorWithMessage = (
  value: unknown
): value is { message: string } => {
  return isObject(value) && "message" in value && isString(value.message);
};

/**
 * 関数の型ガード
 */
export const isFunction = (value: unknown): value is Function => {
  return typeof value === "function";
};

export const isSyncFunction = <T extends readonly unknown[], R>(
  value: unknown
): value is (...args: T) => R => {
  return isFunction(value);
};

export const isAsyncFunction = <T extends readonly unknown[], R>(
  value: unknown
): value is (...args: T) => Promise<R> => {
  return isFunction(value);
};

/**
 * 汎用的な型の絞り込み
 */
export const isDefined = <T>(value: T | undefined): value is T => {
  return value !== undefined;
};

export const isNotNull = <T>(value: T | null): value is T => {
  return value !== null;
};

export const isPresent = <T>(value: T | null | undefined): value is T => {
  return value !== null && value !== undefined;
};

/**
 * 型アサーション用のヘルパー
 */
export const assertType = <T>(
  value: unknown,
  guard: (value: unknown) => value is T,
  errorMessage?: string
): asserts value is T => {
  if (!guard(value)) {
    throw new TypeError(errorMessage || `Value does not match expected type`);
  }
};

export const assertArray = <T>(
  value: unknown,
  itemGuard: (item: unknown) => item is T,
  errorMessage?: string
): asserts value is T[] => {
  if (!isArrayOf(value, itemGuard)) {
    throw new TypeError(
      errorMessage || `Value is not a valid array of the expected type`
    );
  }
};

/**
 * 実行時型検証のためのヘルパー
 */
export const validate = <T>(
  value: unknown,
  guard: (value: unknown) => value is T
): { isValid: true; value: T } | { isValid: false; error: string } => {
  if (guard(value)) {
    return { isValid: true, value };
  }
  return { isValid: false, error: "Type validation failed" };
};

export const validateArray = <T>(
  value: unknown,
  itemGuard: (item: unknown) => item is T
): { isValid: true; value: T[] } | { isValid: false; error: string } => {
  return validate(value, (v): v is T[] => isArrayOf(v, itemGuard));
};
