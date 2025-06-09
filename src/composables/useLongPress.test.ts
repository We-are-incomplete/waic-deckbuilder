import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useLongPress } from "./useLongPress";

describe("useLongPress", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("長押しコールバックが指定した時間後に呼ばれる", async () => {
    const onLongPress = vi.fn();
    const { startPress, endPress } = useLongPress({
      delay: 500,
      onLongPress,
    });

    const mockEvent = new Event("mousedown");
    startPress(mockEvent);

    // 500ms経過前は呼ばれない
    vi.advanceTimersByTime(400);
    expect(onLongPress).not.toHaveBeenCalled();

    // 500ms経過後に呼ばれる
    vi.advanceTimersByTime(100);
    expect(onLongPress).toHaveBeenCalledTimes(1);

    endPress();
  });

  it("短時間で終了した場合は通常のプレスコールバックが呼ばれる", () => {
    const onLongPress = vi.fn();
    const onPress = vi.fn();
    const { startPress, endPress } = useLongPress({
      delay: 500,
      onLongPress,
      onPress,
    });

    const mockEvent = new Event("mousedown");
    startPress(mockEvent);

    // 短時間で終了
    vi.advanceTimersByTime(200);
    endPress();

    expect(onLongPress).not.toHaveBeenCalled();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("キャンセルした場合はどちらのコールバックも呼ばれない", () => {
    const onLongPress = vi.fn();
    const onPress = vi.fn();
    const { startPress, cancelPress } = useLongPress({
      delay: 500,
      onLongPress,
      onPress,
    });

    const mockEvent = new Event("mousedown");
    startPress(mockEvent);

    vi.advanceTimersByTime(300);
    cancelPress();

    // さらに時間が経過しても呼ばれない
    vi.advanceTimersByTime(300);
    expect(onLongPress).not.toHaveBeenCalled();
    expect(onPress).not.toHaveBeenCalled();
  });

  it("長押し後に終了してもプレスコールバックは呼ばれない", () => {
    const onLongPress = vi.fn();
    const onPress = vi.fn();
    const { startPress, endPress } = useLongPress({
      delay: 500,
      onLongPress,
      onPress,
    });

    const mockEvent = new Event("mousedown");
    startPress(mockEvent);

    // 長押し時間経過
    vi.advanceTimersByTime(500);
    expect(onLongPress).toHaveBeenCalledTimes(1);

    // 終了してもプレスコールバックは呼ばれない
    endPress();
    expect(onPress).not.toHaveBeenCalled();
  });

  it("デフォルトの長押し時間が500msに設定されている", () => {
    const onLongPress = vi.fn();
    const { startPress } = useLongPress({ onLongPress });

    const mockEvent = new Event("mousedown");
    startPress(mockEvent);

    vi.advanceTimersByTime(499);
    expect(onLongPress).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it("イベントのpreventDefaultが呼ばれる", () => {
    const { startPress } = useLongPress({});
    const mockEvent = new Event("mousedown");
    const preventDefaultSpy = vi.spyOn(mockEvent, "preventDefault");

    startPress(mockEvent);

    expect(preventDefaultSpy).toHaveBeenCalled();
  });
});
