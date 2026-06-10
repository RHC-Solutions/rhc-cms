// Linear-time URL / slug normalizers.
//
// These replace trailing/leading-slash regexes that backtrack quadratically on
// adversarial input (CodeQL `js/polynomial-redos`). The old idioms
//   s.replace(/\/+$/, '')        // strip trailing slashes
//   s.replace(/^\/+|\/+$/g, '')  // trim leading + trailing slashes
// are O(n²) on a long run of '/' followed by a non-slash, because the greedy `\/+`
// re-scans and backtracks at every start position. We scan with charCodeAt instead —
// no backtracking, no regex engine, so worst-case input is strictly linear.

const SLASH = 47; // '/'.charCodeAt(0)

/** Remove all leading and trailing '/' characters (internal slashes preserved).
 *  Behaviour-identical to `s.replace(/^\/+|\/+$/g, '')`, but linear-time. */
export function trimSlashes(s: string): string {
  let start = 0;
  let end = s.length;
  while (start < end && s.charCodeAt(start) === SLASH) start++;
  while (end > start && s.charCodeAt(end - 1) === SLASH) end--;
  return start === 0 && end === s.length ? s : s.slice(start, end);
}

/** Strip trailing '/' characters only.
 *  Behaviour-identical to `s.replace(/\/+$/, '')`, but linear-time. */
export function stripTrailingSlashes(s: string): string {
  let end = s.length;
  while (end > 0 && s.charCodeAt(end - 1) === SLASH) end--;
  return end === s.length ? s : s.slice(0, end);
}

/** Normalize a user-supplied domain to a bare host: drop an `http(s)://` scheme and
 *  any trailing slashes, then trim surrounding whitespace. Linear-time and safe on
 *  hostile input. Behaviour-identical to
 *  `String(input ?? '').replace(/^https?:\/\//i, '').replace(/\/+$/, '').trim()`
 *  (the `?? ''` maps null/undefined to '' rather than the strings "null"/"undefined").
 *  (The scheme regex is start-anchored and fixed-shape, so it is not polynomial.) */
export function domainToHost(input: unknown): string {
  const noScheme = String(input ?? '').replace(/^https?:\/\//i, '');
  return stripTrailingSlashes(noScheme).trim();
}
