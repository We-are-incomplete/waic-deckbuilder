import { ok, err, type Result } from "neverthrow";
import {
  isString,
  isNumber,
  isArray,
  isObject,
  isCard,
  isDeckCard,
  isFilterCriteria,
  isPresent,
  isPositiveNumber,
  isNonEmptyString,
} from "./typeGuards";
import type { Card, DeckCard, FilterCriteria } from "../types";

// 安全な操作のエラー型
export type SafeOperationError =
  | {
      readonly type: "invalidInput";
      readonly message: string;
      readonly value: unknown;
    }
  | {
      readonly type: "parseError";
      readonly message: string;
      readonly input: string;
    }
  | {
      readonly type: "validationError";
      readonly message: string;
      readonly value: unknown;
    }
  | {
      readonly type: "conversionError";
      readonly message: string;
      readonly from: unknown;
    };

/**
 * 安全な JSON パース
 */
export const safeJsonParse = <T>(
  jsonString: string,
  validator?: (value: unknown) => value is T
): Result<T, SafeOperationError> => {
  if (!isString(jsonString)) {
    return err({
      type: "invalidInput",
      message: "Input must be a string",
      value: jsonString,
    });
  }

  try {
    const parsed = JSON.parse(jsonString);

    if (validator) {
      if (validator(parsed)) {
        return ok(parsed);
      } else {
        return err({
          type: "validationError",
          message: "Parsed value does not match expected type",
          value: parsed,
        });
      }
    }

    return ok(parsed as T);
  } catch (error) {
    return err({
      type: "parseError",
      message: error instanceof Error ? error.message : "JSON parse failed",
      input: jsonString,
    });
  }
};

/**
 * 安全な数値変換
 */
export const safeParseNumber = (
  value: unknown
): Result<number, SafeOperationError> => {
  if (isNumber(value)) {
    return ok(value);
  }

  if (isString(value)) {
    const trimmed = value.trim();
    if (trimmed === "") {
      return err({
        type: "conversionError",
        message: "Empty string cannot be converted to number",
        from: value,
      });
    }

    const parsed = Number(trimmed);
    if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
      return err({
        type: "conversionError",
        message: "String cannot be converted to valid number",
        from: value,
      });
    }

    return ok(parsed);
  }

  return err({
    type: "conversionError",
    message: "Value cannot be converted to number",
    from: value,
  });
};

/**
 * 安全な整数変換
 */
export const safeParseInteger = (
  value: unknown
): Result<number, SafeOperationError> => {
  const numberResult = safeParseNumber(value);

  if (numberResult.isErr()) {
    return numberResult;
  }

  const num = numberResult.value;
  if (!Number.isInteger(num)) {
    return err({
      type: "conversionError",
      message: "Number is not an integer",
      from: value,
    });
  }

  return ok(num);
};

/**
 * 安全な正の数変換
 */
export const safeParsePositiveNumber = (
  value: unknown
): Result<number, SafeOperationError> => {
  const numberResult = safeParseNumber(value);

  if (numberResult.isErr()) {
    return numberResult;
  }

  const num = numberResult.value;
  if (!isPositiveNumber(num)) {
    return err({
      type: "validationError",
      message: "Number must be positive",
      value: num,
    });
  }

  return ok(num);
};

/**
 * 安全な配列操作
 */
export const safeArrayAccess = <T>(
  array: readonly T[],
  index: number
): Result<T, SafeOperationError> => {
  if (!isArray(array)) {
    return err({
      type: "invalidInput",
      message: "First argument must be an array",
      value: array,
    });
  }

  if (!Number.isInteger(index)) {
    return err({
      type: "invalidInput",
      message: "Index must be an integer",
      value: index,
    });
  }

  if (index < 0 || index >= array.length) {
    return err({
      type: "validationError",
      message: `Index ${index} is out of bounds for array of length ${array.length}`,
      value: index,
    });
  }

  return ok(array[index]);
};

export const safeArrayFind = <T>(
  array: readonly T[],
  predicate: (item: T) => boolean
): Result<T, SafeOperationError> => {
  if (!isArray(array)) {
    return err({
      type: "invalidInput",
      message: "First argument must be an array",
      value: array,
    });
  }

  const found = array.find(predicate);
  if (!isPresent(found)) {
    return err({
      type: "validationError",
      message: "No item found matching the predicate",
      value: array,
    });
  }

  return ok(found);
};

export const safeArrayFilter = <T, U extends T>(
  array: readonly T[],
  predicate: (item: T) => item is U
): Result<U[], SafeOperationError> => {
  if (!isArray(array)) {
    return err({
      type: "invalidInput",
      message: "First argument must be an array",
      value: array,
    });
  }

  const filtered = array.filter(predicate);
  return ok(filtered);
};

/**
 * 安全なオブジェクト操作
 */
export const safeObjectAccess = <T>(
  obj: Record<string, unknown>,
  key: string,
  validator: (value: unknown) => value is T
): Result<T, SafeOperationError> => {
  if (!isObject(obj)) {
    return err({
      type: "invalidInput",
      message: "First argument must be an object",
      value: obj,
    });
  }

  if (!isNonEmptyString(key)) {
    return err({
      type: "invalidInput",
      message: "Key must be a non-empty string",
      value: key,
    });
  }

  const value = obj[key];
  if (!validator(value)) {
    return err({
      type: "validationError",
      message: `Value at key '${key}' does not match expected type`,
      value,
    });
  }

  return ok(value);
};

export const safeObjectKeys = <T extends Record<string, unknown>>(
  obj: T
): Result<(keyof T)[], SafeOperationError> => {
  if (!isObject(obj)) {
    return err({
      type: "invalidInput",
      message: "Argument must be an object",
      value: obj,
    });
  }

  return ok(Object.keys(obj) as (keyof T)[]);
};

/**
 * 安全なドメイン固有操作
 */
export const safeCardParse = (
  data: unknown
): Result<Card, SafeOperationError> => {
  if (!isCard(data)) {
    return err({
      type: "validationError",
      message: "Data does not represent a valid Card",
      value: data,
    });
  }

  return ok(data);
};

export const safeDeckCardParse = (
  data: unknown
): Result<DeckCard, SafeOperationError> => {
  if (!isDeckCard(data)) {
    return err({
      type: "validationError",
      message: "Data does not represent a valid DeckCard",
      value: data,
    });
  }

  return ok(data);
};

export const safeFilterCriteriaParse = (
  data: unknown
): Result<FilterCriteria, SafeOperationError> => {
  if (!isFilterCriteria(data)) {
    return err({
      type: "validationError",
      message: "Data does not represent valid FilterCriteria",
      value: data,
    });
  }

  return ok(data);
};

/**
 * 安全な配列変換
 */
export const safeCardsArrayParse = (
  data: unknown
): Result<Card[], SafeOperationError> => {
  if (!isArray(data)) {
    return err({
      type: "invalidInput",
      message: "Data must be an array",
      value: data,
    });
  }

  const cards: Card[] = [];
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (!isCard(item)) {
      return err({
        type: "validationError",
        message: `Item at index ${i} is not a valid Card`,
        value: item,
      });
    }
    cards.push(item);
  }

  return ok(cards);
};

export const safeDeckCardsArrayParse = (
  data: unknown
): Result<DeckCard[], SafeOperationError> => {
  if (!isArray(data)) {
    return err({
      type: "invalidInput",
      message: "Data must be an array",
      value: data,
    });
  }

  const deckCards: DeckCard[] = [];
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (!isDeckCard(item)) {
      return err({
        type: "validationError",
        message: `Item at index ${i} is not a valid DeckCard`,
        value: item,
      });
    }
    deckCards.push(item);
  }

  return ok(deckCards);
};

/**
 * 安全な変換パイプライン
 */
export const safePipeline = <T1, T2, T3>(
  input: T1,
  op1: (input: T1) => Result<T2, SafeOperationError>,
  op2: (input: T2) => Result<T3, SafeOperationError>
): Result<T3, SafeOperationError> => {
  const result1 = op1(input);
  if (result1.isErr()) {
    return err(result1.error);
  }

  return op2(result1.value);
};

export const safeChain = <T>(
  input: T,
  operations: ((input: T) => Result<T, SafeOperationError>)[]
): Result<T, SafeOperationError> => {
  let current: Result<T, SafeOperationError> = ok(input);

  for (const operation of operations) {
    if (current.isErr()) {
      return current;
    }
    current = operation(current.value);
  }

  return current;
};

/**
 * 安全なデフォルト値提供
 */
export const withDefault = <T>(
  result: Result<T, SafeOperationError>,
  defaultValue: T
): T => {
  return result.isOk() ? result.value : defaultValue;
};

export const withDefaultFactory = <T>(
  result: Result<T, SafeOperationError>,
  defaultFactory: () => T
): T => {
  return result.isOk() ? result.value : defaultFactory();
};

/**
 * 安全なマッピング操作
 */
export const safeMap = <T, U>(
  items: readonly T[],
  mapper: (item: T, index: number) => Result<U, SafeOperationError>
): Result<U[], SafeOperationError> => {
  if (!isArray(items)) {
    return err({
      type: "invalidInput",
      message: "First argument must be an array",
      value: items,
    });
  }

  const results: U[] = [];
  for (let i = 0; i < items.length; i++) {
    const result = mapper(items[i], i);
    if (result.isErr()) {
      return err(result.error);
    }
    results.push(result.value);
  }

  return ok(results);
};

/**
 * 安全なレデュース操作
 */
export const safeReduce = <T, U>(
  items: readonly T[],
  reducer: (acc: U, item: T, index: number) => Result<U, SafeOperationError>,
  initialValue: U
): Result<U, SafeOperationError> => {
  if (!isArray(items)) {
    return err({
      type: "invalidInput",
      message: "First argument must be an array",
      value: items,
    });
  }

  let accumulator = initialValue;
  for (let i = 0; i < items.length; i++) {
    const result = reducer(accumulator, items[i], i);
    if (result.isErr()) {
      return result;
    }
    accumulator = result.value;
  }

  return ok(accumulator);
};
