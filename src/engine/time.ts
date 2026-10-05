/** Longest accepted Speed Fit time: just under 24 h. Matches the CHECK on speed_fit_times.time_ms. */
export const MAX_TIME_MS = 24 * 60 * 60 * 1000 - 10;

/**
 * Parses a time typed by a judge into milliseconds, at hundredth-of-a-second precision.
 * Accepts "83.4", "1:23.45", "01:23" and "1:02:03.5". Returns undefined if it isn't a valid time.
 */
export function parseDuration(text: string): number | undefined {
  const match = /^(?:(?:(\d+):)?(\d+):)?(\d+)(?:[.,](\d{1,2}))?$/.exec(text.trim());
  if (!match) return undefined;
  const [, hoursText, minutesText, secondsText, fractionText] = match;
  const hours = Number(hoursText ?? 0);
  const minutes = Number(minutesText ?? 0);
  const seconds = Number(secondsText);
  // A unit may only overflow 59 when it is the largest one written ("90" seconds is fine, "1:90" isn't).
  if (minutesText !== undefined && seconds > 59) return undefined;
  if (hoursText !== undefined && minutes > 59) return undefined;
  const hundredths = Number((fractionText ?? "0").padEnd(2, "0"));
  const ms = ((hours * 60 + minutes) * 60 + seconds) * 1000 + hundredths * 10;
  return ms > 0 && ms <= MAX_TIME_MS ? ms : undefined;
}

/** 83450 → "1:23.45"; an hour or more → "1:02:03.50". */
export function formatDuration(ms: number): string {
  const hundredths = Math.round(ms / 10);
  const pad = (n: number) => String(n).padStart(2, "0");
  const totalSeconds = Math.floor(hundredths / 100);
  const fraction = pad(hundredths % 100);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes >= 60) return `${Math.floor(totalMinutes / 60)}:${pad(totalMinutes % 60)}:${pad(seconds)}.${fraction}`;
  return `${totalMinutes}:${pad(seconds)}.${fraction}`;
}
