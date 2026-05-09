/**
 * Minimal interface a throttle backend must implement to be usable with
 * the {@link throttle} hook. Implementations are responsible for enforcing
 * concurrency, queueing, and any rate/window limits internally.
 *
 * `schedule` should:
 * - run `fn` once the task has been admitted and return its result
 * - throw `TooManyRequests` (from `@feathersjs/errors`) when the queue is full
 * - throw `Timeout` (from `@feathersjs/errors`) when a task waits too long
 * - propagate any error thrown by `fn` itself unchanged
 *
 * The built-in {@link MemoryThrottle} ships in this package. Users who need
 * distributed coordination across instances can implement this interface
 * against Redis or wrap a third-party library such as Bottleneck or p-queue.
 */
export interface ThrottleAbstract {
  schedule<T>(key: string, fn: () => Promise<T>): Promise<T>
}
