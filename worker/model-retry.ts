/** Retry only explicit transient service rejection, never invalid or rejected content. */
export async function retryModelCapacity<T>(
  run: () => Promise<T>,
  pause: (milliseconds: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms)),
  onRetry: (attempt: number) => void = () => {},
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await run(); }
    catch (error) {
      if (attempt >= 2 || !/selected model is at capacity|service (?:is )?overloaded/i.test(String(error))) throw error;
      onRetry(attempt + 1);
      await pause(20000 * (attempt + 1));
    }
  }
}
