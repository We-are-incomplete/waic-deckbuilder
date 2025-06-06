import { ref } from "vue";

export interface ToastMessage {
  id: string;
  message: string;
  type: "success" | "error" | "warning" | "info";
  duration?: number;
}

export function useToast() {
  const toasts = ref<ToastMessage[]>([]);

  const showToast = (
    message: string,
    type: ToastMessage["type"] = "info",
    duration = 5000
  ): void => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const toast: ToastMessage = {
      id,
      message,
      type,
      duration,
    };

    toasts.value.push(toast);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  };

  const removeToast = (id: string): void => {
    const index = toasts.value.findIndex((toast) => toast.id === id);
    if (index > -1) {
      toasts.value.splice(index, 1);
    }
  };

  const clearAllToasts = (): void => {
    toasts.value = [];
  };

  // Convenience methods
  const showError = (message: string): void => {
    showToast(message, "error");
  };

  const showSuccess = (message: string): void => {
    showToast(message, "success");
  };

  const showWarning = (message: string): void => {
    showToast(message, "warning");
  };

  const showInfo = (message: string): void => {
    showToast(message, "info");
  };

  return {
    toasts,
    showToast,
    removeToast,
    clearAllToasts,
    showError,
    showSuccess,
    showWarning,
    showInfo,
  };
}
