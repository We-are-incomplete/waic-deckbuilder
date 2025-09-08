import { reactive, watchEffect, type Ref } from "vue";
import { onLongPress } from "@vueuse/core";
import type { Card } from "../types";

/**
 * カードの長押しで画像モーダルを開くロジックを共通化するコンポーザブル
 * @param openImageModal - 画像モーダルを開く関数
 * @param cards - 長押しイベントを設定するカードのリスト
 */
export function useLongPressImageModal(
  openImageModal: (cardId: string) => void,
  cards: Readonly<Ref<readonly Card[]>>,
  options?: { delay?: number },
) {
  const cardRefs = reactive(new Map<string, HTMLElement>());

  const setCardRef = (el: unknown, cardId: string) => {
    if (el instanceof HTMLElement) {
      cardRefs.set(cardId, el);
    } else {
      cardRefs.delete(cardId);
    }
  };

  watchEffect((onCleanup) => {
    const stops: Array<() => void> = [];
    cards.value.forEach((card) => {
      const el = cardRefs.get(card.id);
      if (el) {
        const stop = onLongPress(el, () => openImageModal(card.id), {
          delay: options?.delay ?? 500,
        });
        stops.push(stop);
      }
    });
    onCleanup(() => {
      stops.forEach((stop) => stop());
    });
  });

  return {
    setCardRef,
  };
}
