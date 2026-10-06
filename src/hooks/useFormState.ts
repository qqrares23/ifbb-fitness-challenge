import { useState, type FormEvent } from "react";

/**
 * State of a dialog form: its values, a typed per-field setter, and whether a submit was tried
 * (forms show validation errors only after that). `onSubmit(save)` is the form's submit handler.
 */
export function useFormState<T extends object>(initial: T | (() => T)) {
  const [values, setValues] = useState<T>(initial);
  const [submitted, setSubmitted] = useState(false);
  const set = <K extends keyof T>(key: K, value: T[K]) => setValues((v) => ({ ...v, [key]: value }));
  const onSubmit = (save: () => void) => (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    save();
  };
  return { values, set, submitted, onSubmit };
}
