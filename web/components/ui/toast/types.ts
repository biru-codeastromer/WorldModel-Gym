export type ToastTone = "success" | "error" | "info";

export type ToastItem = {
  /** Stable id used for dedupe / dismissal. */
  id: string;
  tone: ToastTone;
  /** Primary line. */
  title: string;
  /** Optional secondary line. */
  description?: string;
  /** Auto-dismiss delay in ms. `0` keeps the toast until dismissed. */
  duration: number;
};

export type ToastInput = {
  title: string;
  description?: string;
  /** Override the auto-dismiss delay (ms). Defaults to 4000; `0` = sticky. */
  duration?: number;
};

/** Public toast API, exposed both via the `toast` singleton and `useToast()`. */
export type ToastApi = {
  success: (title: string, opts?: Omit<ToastInput, "title">) => string;
  error: (title: string, opts?: Omit<ToastInput, "title">) => string;
  info: (title: string, opts?: Omit<ToastInput, "title">) => string;
  /** Imperatively dismiss a toast by id. */
  dismiss: (id: string) => void;
};
