"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

interface BookDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children?: React.ReactNode;
}

export function BookDetailsModal({
  isOpen,
  onClose,
  title,
  children,
}: BookDetailsModalProps) {
  const isBrowser = typeof document !== "undefined";

  useEffect(() => {
    if (!isOpen || !isBrowser) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, isBrowser]);

  if (!isOpen || !isBrowser) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="book-details-modal-title"
    >
      <div
        className="flex h-[560px] w-[720px] max-h-[calc(100vh-2rem)] max-w-[92vw] min-w-0 flex-col overflow-hidden rounded-lg bg-white shadow-lg sm:min-w-[360px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b p-4">
          <h2 id="book-details-modal-title" className="text-lg font-semibold">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-2xl leading-none text-gray-500 hover:text-gray-700"
            aria-label="Close modal"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}
