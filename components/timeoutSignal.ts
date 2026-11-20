/** A signal for fetch() that gives up after `ms` milliseconds, or as soon as `signal` (when given) is aborted: a request
    that never answers ends with an error the page can show, instead of a spinner that turns forever. Made by hand rather
    than with AbortSignal.timeout/any, which some phones still in use don't have. */
export function timeoutSignal(ms: number, signal?: AbortSignal | null): AbortSignal {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(new DOMException("The request took too long", "TimeoutError")), ms);
  const give = () => {
    clearTimeout(timer);
    stop.abort(signal?.reason);
  };
  if (signal?.aborted) give();
  else signal?.addEventListener("abort", give, { once: true });
  return stop.signal;
}
