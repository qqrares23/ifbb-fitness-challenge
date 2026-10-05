import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CommitNumberInputProps {
  value: number | null;
  /** Called with the new value when the field is left or Enter is pressed; a rejected promise restores the saved value. */
  onCommit: (value: number | null) => unknown;
  min: number;
  max: number;
  /** Whether clearing the field commits null; otherwise an empty field is restored. */
  allowEmpty?: boolean;
  "aria-label": string;
  className?: string;
}

/**
 * A whole-number field that saves on blur / Enter and reverts on Escape or a failed save.
 * Remounts whenever the saved value changes, so it always shows what's stored.
 */
export function CommitNumberInput(props: CommitNumberInputProps) {
  return <CommitNumberField key={String(props.value)} {...props} />;
}

function CommitNumberField({ value, onCommit, min, max, allowEmpty = false, className, ...rest }: CommitNumberInputProps) {
  const saved = value === null ? "" : String(value);
  const [text, setText] = useState(saved);
  const revert = () => setText(saved);

  function commit() {
    const trimmed = text.trim();
    if (trimmed === "") {
      if (allowEmpty && value !== null) void Promise.resolve(onCommit(null)).catch(revert);
      else revert();
      return;
    }
    const next = Number(trimmed);
    if (!Number.isInteger(next) || next < min || next > max) {
      toast.error(`Enter a whole number from ${min} to ${max}.`);
      revert();
      return;
    }
    if (next !== value) void Promise.resolve(onCommit(next)).catch(revert);
  }

  return (
    <Input
      {...rest}
      inputMode="numeric"
      className={cn("h-8 text-center tabular-nums", className)}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          revert();
          // Let the reverted text render before leaving, so blur doesn't commit the edit.
          const field = e.currentTarget;
          requestAnimationFrame(() => field.blur());
        }
      }}
    />
  );
}
