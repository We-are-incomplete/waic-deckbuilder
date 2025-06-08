import { ref } from "vue";
import { useToast } from "./useToast";

export function useDeckReset(
  resetDeckCards: () => void,
  resetDeckName: () => void
) {
  const showResetConfirmModal = ref<boolean>(false);
  const { showSuccess } = useToast();

  /**
   * デッキをリセット（確認ダイアログを表示）
   */
  const resetDeck = (): void => {
    showResetConfirmModal.value = true;
  };

  /**
   * デッキリセットの確認を受け取った場合の処理
   */
  const confirmResetDeck = (): void => {
    resetDeckCards();
    resetDeckName();
    showResetConfirmModal.value = false;
    showSuccess("デッキをリセットしました");
  };

  /**
   * デッキリセットの確認をキャンセル
   */
  const cancelResetDeck = (): void => {
    showResetConfirmModal.value = false;
  };

  return {
    showResetConfirmModal,
    resetDeck,
    confirmResetDeck,
    cancelResetDeck,
  };
}
