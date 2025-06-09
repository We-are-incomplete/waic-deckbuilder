import { ref, onBeforeUnmount } from "vue";

export interface UseLongPressOptions {
  delay?: number; // 長押しとみなす時間（ミリ秒）
  onLongPress?: () => void; // 長押し時のコールバック
  onPress?: () => void; // 通常のプレス時のコールバック
}

export function useLongPress(options: UseLongPressOptions = {}) {
  const { delay = 500, onLongPress, onPress } = options;

  let pressTimer: number | null = null;
  let isLongPress = ref(false);

  const startPress = (event: Event) => {
    // デフォルトのコンテキストメニューを無効化
    event.preventDefault();

    isLongPress.value = false;
    pressTimer = setTimeout(() => {
      isLongPress.value = true;
      onLongPress?.();
    }, delay);
  };

  const endPress = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }

    // 長押しでない場合は通常のプレスとして処理
    if (!isLongPress.value && onPress) {
      onPress();
    }

    isLongPress.value = false;
  };

  const cancelPress = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
    isLongPress.value = false;
  };

  // クリーンアップ
  onBeforeUnmount(() => {
    if (pressTimer) {
      clearTimeout(pressTimer);
    }
  });

  return {
    startPress,
    endPress,
    cancelPress,
    isLongPress,
  };
}
