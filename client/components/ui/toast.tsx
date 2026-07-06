import * as React from "react";
import { CheckCircle2, X } from "lucide-react";

import { cn } from "@/lib/utils";

type ToastProps = {
  description?: string;
  onClose?: () => void;
  title: string;
};

export function Toast({ description, onClose, title }: ToastProps) {
  React.useEffect(() => {
    if (!onClose) return;

    const timer = setTimeout(() => {
      onClose();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={cn(
        "fixed bottom-5 right-5 z-50 flex w-[calc(100vw-2rem)] max-w-sm items-start gap-3 rounded-lg border border-blue-200 bg-white p-4 text-foreground shadow-lg"
      )}
      role="status"
    >
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700">
        <CheckCircle2 aria-hidden="true" className="size-4" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>

        {description && (
          <p className="mt-1 break-words text-sm leading-5 text-muted-foreground">
            {description}
          </p>
        )}
      </div>

      {onClose && (
        <button
          type="button"
          aria-label="Close notification"
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={onClose}
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      )}
    </div>
  );
}