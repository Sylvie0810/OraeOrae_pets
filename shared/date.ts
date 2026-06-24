// Korea Standard Time date helpers.
// The app is used in Korea, so "today" must always be the Asia/Seoul calendar
// day — never the server's UTC day or the browser's local day.
// `new Date().toISOString().slice(0,10)` returns the UTC date, which is wrong
// for ~9 hours every day in Korea (e.g. 00:00–09:00 KST is still "yesterday" UTC).

const KST = "Asia/Seoul";

/** Returns today's date in Asia/Seoul as "YYYY-MM-DD". */
export function todayKST(): string {
  return dateKST(new Date());
}

/** Formats any Date as its Asia/Seoul calendar day "YYYY-MM-DD". */
export function dateKST(d: Date): string {
  // en-CA gives ISO-style YYYY-MM-DD; timeZone shifts to Seoul wall-clock.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: KST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Returns the current wall-clock time in Asia/Seoul as "HH:MM" (24h). */
export function nowTimeKST(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: KST,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}
