"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { ClipLoader } from "react-spinners";

type SubmitButtonProps = {
  children: ReactNode;
  className?: string;
  pendingText?: string;
  title: string;
  disabled?: boolean;
};

export function SubmitButton({
  children,
  className = "button",
  pendingText = "Working",
  title,
  disabled
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button className={className} type="submit" title={title} disabled={disabled || pending}>
      {pending ? (
        <>
          <ClipLoader color="currentColor" size={16} />
          {pendingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}
