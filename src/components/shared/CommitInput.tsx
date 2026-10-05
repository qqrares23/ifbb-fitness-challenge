import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { formatDuration, parseDuration } from "@/engine";
import { cn } from "@/lib/utils";

type ParseResult<T> = { value: T } | { error: string };

interface CommitInputProps<T> {
  value: T | null;
  format: (value: T) => string;
  parse: (text: string) => ParseResult<T>;
  /** Called with the new value when the field is left or Enter is pressed; a rejected promise restores the saved value. */
  onCommit: (value: T | null) => unknown;
  /** Whether clearing the field commits null; otherwise an empty field is restored. */
  allowEmpty?: boolean;
  placeholder?: string;
  inputMode?: "numeric" | "text";
  "aria-label": string;
  className?: string;
}

/**
 * A field that saves on blur / Enter and reverts on Escape, invalid input or a failed save.
 * Remounts whenever the saved value changes, so it always shows what's stored.
 */
export function CommitInput<T>(props: CommitInputProps<T>) {
  const key = props.value === null ? "" : props.format(props.value);
  return <CommitField key={key} {...props} />;
}

function CommitField<T>({ value, format, parse, onCommit, allowEmpty = false, className, ...rest }: CommitInputProps<T>) {
  const saved = value === null ? "" : format(value);
  const [text, setText] = useState(saved);
  const revert = () => setText(saved);
  const save = (next: T | null) => void Promise.resolve(onCommit(next)).catch(revert);

  function commit() {
    const trimmed = text.trim();
    if (trimmed === saved) return;
    if (trimmed === "") {
      if (allowEmpty && value !== null) save(null);
      else revert();
      return;
    }
    const parsed = parse(trimmed);
    if ("error" in parsed) {
      toast.error(parsed.error);
      revert();
      return;
    }
    if (format(parsed.value) === saved) revert(); // same value written differently, e.g. "83" for "1:23.00"
    else save(parsed.value);
  }

  return (
    <Input
      {...rest}
      className={cn("h-8 text-center tabular-nums transition-shadow", className)}
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

type WrapperProps<T> = Omit<CommitInputProps<T>, "format" | "parse">;

/** Whole numbers from `min` to `max`. */
export function CommitNumberInput({ min, max, ...props }: WrapperProps<number> & { min: number; max: number }) {
  return (
    <CommitInput<number>
      inputMode="numeric"
      {...props}
      format={String}
      parse={(text) => {
        const n = Number(text);
        return Number.isInteger(n) && n >= min && n <= max ? { value: n } : { error: `Enter a whole number from ${min} to ${max}.` };
      }}
    />
  );
}

/** A duration typed as "1:23.45", "83.4" or "1:02:03.5"; shown as m:ss.cc. */
export function TimeInput(props: WrapperProps<number>) {
  return (
    <CommitInput<number>
      placeholder="m:ss.cc"
      {...props}
      format={formatDuration}
      parse={(text) => {
        const ms = parseDuration(text);
        return ms === undefined ? { error: 'Enter a time like "1:23.45" (minutes:seconds.hundredths).' } : { value: ms };
      }}
    />
  );
}
