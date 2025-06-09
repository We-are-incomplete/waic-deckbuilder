import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { defineComponent } from "vue";
import { mount } from "@vue/test-utils";
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
    let composableResult: ReturnType<typeof useLongPress>;

    const TestComponent = defineComponent({
      setup() {
        composableResult = useLongPress({
          delay: 500,
          onLongPress,
        });
        return composableResult;
      },
      template: "<div></div>",
    });

    const wrapper = mount(TestComponent);
    const { startPress, endPress } = composableResult!;
    const mockEvent = new Event("mousedown");
    startPress(mockEvent);

    // 500ms経過前は呼ばれない
    vi.advanceTimersByTime(400);
    expect(onLongPress).not.toHaveBeenCalled();

    // 500ms経過後に呼ばれる
    vi.advanceTimersByTime(100);
    expect(onLongPress).toHaveBeenCalledTimes(1);

    endPress();
    wrapper.unmount();
  });

  it("短時間で終了した場合は通常のプレスコールバックが呼ばれる", async () => {
    const onLongPress = vi.fn();
    const onPress = vi.fn();
    let composableResult: ReturnType<typeof useLongPress>;

    const TestComponent = defineComponent({
      setup() {
        composableResult = useLongPress({
          delay: 500,
          onLongPress,
          onPress,
        });
        return composableResult;
      },
      template: "<div></div>",
    });

    const wrapper = mount(TestComponent);
    const { startPress, endPress } = composableResult!;
    const mockEvent = new Event("mousedown");
    startPress(mockEvent);

    // 短時間で終了
    vi.advanceTimersByTime(200);
    endPress();

    expect(onLongPress).not.toHaveBeenCalled();
    expect(onPress).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it("キャンセルした場合はどちらのコールバックも呼ばれない", async () => {
    const onLongPress = vi.fn();
    const onPress = vi.fn();
    let composableResult: ReturnType<typeof useLongPress>;

    const TestComponent = defineComponent({
      setup() {
        composableResult = useLongPress({
          delay: 500,
          onLongPress,
          onPress,
        });
        return composableResult;
      },
      template: "<div></div>",
    });

    const wrapper = mount(TestComponent);
    const { startPress, cancelPress } = composableResult!;
    const mockEvent = new Event("mousedown");
    startPress(mockEvent);

    vi.advanceTimersByTime(300);
    cancelPress();

    // さらに時間が経過しても呼ばれない
    vi.advanceTimersByTime(300);
    expect(onLongPress).not.toHaveBeenCalled();
    expect(onPress).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("長押し後に終了してもプレスコールバックは呼ばれない", async () => {
    const onLongPress = vi.fn();
    const onPress = vi.fn();
    let composableResult: ReturnType<typeof useLongPress>;

    const TestComponent = defineComponent({
      setup() {
        composableResult = useLongPress({
          delay: 500,
          onLongPress,
          onPress,
        });
        return composableResult;
      },
      template: "<div></div>",
    });

    const wrapper = mount(TestComponent);
    const { startPress, endPress } = composableResult!;
    const mockEvent = new Event("mousedown");
    startPress(mockEvent);

    // 長押し時間経過
    vi.advanceTimersByTime(500);
    expect(onLongPress).toHaveBeenCalledTimes(1);

    // 終了してもプレスコールバックは呼ばれない
    endPress();
    expect(onPress).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("デフォルトの長押し時間が500msに設定されている", async () => {
    const onLongPress = vi.fn();
    let composableResult: ReturnType<typeof useLongPress>;

    const TestComponent = defineComponent({
      setup() {
        composableResult = useLongPress({ onLongPress });
        return composableResult;
      },
      template: "<div></div>",
    });

    const wrapper = mount(TestComponent);
    const { startPress } = composableResult!;
    const mockEvent = new Event("mousedown");
    startPress(mockEvent);

    vi.advanceTimersByTime(499);
    expect(onLongPress).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onLongPress).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it("contextmenuイベントのpreventDefaultが呼ばれる", async () => {
    let composableResult: ReturnType<typeof useLongPress>;

    const TestComponent = defineComponent({
      setup() {
        composableResult = useLongPress({});
        return composableResult;
      },
      template: "<div></div>",
    });

    const wrapper = mount(TestComponent);
    const { startPress } = composableResult!;
    const mockEvent = new Event("contextmenu");
    const preventDefaultSpy = vi.spyOn(mockEvent, "preventDefault");

    startPress(mockEvent);

    expect(preventDefaultSpy).toHaveBeenCalled();
    wrapper.unmount();
  });
});
