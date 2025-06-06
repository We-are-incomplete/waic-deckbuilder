import { ref } from "vue";

export interface ToastMessage {
  id: string;
  message: string;
  type: "success" | "error" | "warning" | "info";
  duration?: number;
  timeoutId?: number;
}

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function useToast() {
  const toasts = ref<ToastMessage[]>([]);

  const showToast = (
    message: string,
    type: ToastMessage["type"] = "info",
    duration = 5000
  ): void => {
    const id = generateUUID();
    const toast: ToastMessage = {
      id,
      message,
      type,
      duration,
    };

    toasts.value.push(toast);

    if (duration > 0) {
      const timeoutId = setTimeout(() => {
        removeToast(id);
      }, duration);

      const toastIndex = toasts.value.findIndex((t) => t.id === id);
      if (toastIndex > -1) {
        toasts.value[toastIndex].timeoutId = timeoutId;
      }
    }
  };

  const removeToast = (id: string): void => {
    const index = toasts.value.findIndex((toast) => toast.id === id);
    if (index > -1) {
      const toast = toasts.value[index];

      if (toast.timeoutId) {
        clearTimeout(toast.timeoutId);
      }

      toasts.value.splice(index, 1);
    }
  };

  const clearAllToasts = (): void => {
    toasts.value.forEach((toast) => {
      if (toast.timeoutId) {
        clearTimeout(toast.timeoutId);
      }
    });
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
