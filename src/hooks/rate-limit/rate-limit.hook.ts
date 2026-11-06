import { TooManyRequests } from '@feathersjs/errors'
import type { HookContext, NextFunction } from '@feathersjs/feathers'
import type {
  BurstyRateLimiter,
  RateLimiterAbstract,
  RateLimiterRes,
} from 'rate-limiter-flexible'
import { checkContext } from '../../utils/index.js'
import { resolveBoolean } from '../../common/index.js'
import type { Promisable } from '../../internal.utils.js'
import type { PredicateFn } from '../../types.js'

export type RateLimitOptions<H extends HookContext = HookContext> = {
  /**
   * The rate-limiting key, or a function to derive it from the context.
   *
   * Pass a static string to use a single shared bucket (a global rate limit
   * across all requests), or a function to compute the key per request
   * (e.g. per user or per IP).
   *
   * @default context.path
   */
  key?: string | ((context: H) => Promisable<string>)
  /**
   * Number of points to consume per request, or a function to compute it from
   * the context.
   *
   * @default 1
   */
  points?: number | ((context: H) => Promisable<number>)
  /**
   * Lets a call over the limit through, to measure before enforcing: it still
   * consumes its points and reaches `onLimited` and the headers, but gets no
   * `Retry-After` and no `TooManyRequests`. A predicate decides per call, e.g.
   * to enforce for some callers first.
   *
   * @default false
   * @example
   * ```ts
   * rateLimit(rateLimiter, {
   *   dryRun: true,
   *   onLimited: (info, context) => logger.warn('over the limit', context.params.user?.id),
   * })
   * ```
   */
  dryRun?: boolean | PredicateFn<H>
  /**
   * Called for every call over the limit, rejected or let through by `dryRun`,
   * e.g. to log or count it. A store that fails is no call over the limit.
   */
  onLimited?: (info: RateLimitInfo, context: H) => Promisable<void>
  /**
   * Tells the client where it stands, on `context.http.headers` for REST
   * transports: `'legacy'` sends `X-RateLimit-Limit`, `-Remaining` and `-Reset`
   * (epoch seconds), `'draft-6'`, `'draft-7'` and `'draft-8'` the `RateLimit`
   * fields of the IETF draft in that version. A function returns headers of
   * your own. A rejection adds `Retry-After` and carries the headers on
   * `error.data.headers`, since Feathers' REST error handlers don't send
   * hook headers.
   *
   * @default false
   * @example
   * ```ts
   * rateLimit(rateLimiter, { headers: 'draft-8' })
   * ```
   */
  headers?:
    | false
    | RateLimitHeaderFormat
    | ((info: RateLimitInfo, context: H) => Record<string, string>)
}

export type RateLimitHeaderFormat = 'legacy' | 'draft-6' | 'draft-7' | 'draft-8'

/** Where a caller stands, as the headers report it. */
export type RateLimitInfo = {
  /** Points per window. */
  limit: number
  /** Points left in the current window. */
  remaining: number
  /** Seconds until the window resets. */
  reset: number
  /** The window, in seconds. */
  window: number
  /** Whether this call is over the limit: rejected, unless `dryRun`. */
  limited: boolean
}

const formats: Record<
  RateLimitHeaderFormat,
  (info: RateLimitInfo) => Record<string, string>
> = {
  legacy: ({ limit, remaining, reset }) => ({
    'X-RateLimit-Limit': `${limit}`,
    'X-RateLimit-Remaining': `${remaining}`,
    'X-RateLimit-Reset': `${Math.ceil(Date.now() / 1000) + reset}`,
  }),
  'draft-6': ({ limit, remaining, reset, window }) => ({
    'RateLimit-Policy': `${limit};w=${window}`,
    'RateLimit-Limit': `${limit}`,
    'RateLimit-Remaining': `${remaining}`,
    'RateLimit-Reset': `${reset}`,
  }),
  'draft-7': ({ limit, remaining, reset, window }) => ({
    'RateLimit-Policy': `${limit};w=${window}`,
    RateLimit: `limit=${limit}, remaining=${remaining}, reset=${reset}`,
  }),
  'draft-8': ({ limit, remaining, reset, window }) => {
    const name = `${limit}-in-${window}sec`
    return {
      'RateLimit-Policy': `"${name}";q=${limit};w=${window}`,
      RateLimit: `"${name}";r=${remaining};t=${reset}`,
    }
  },
}

/** A limiter of `rate-limiter-flexible`, a `BurstyRateLimiter` for bursts too. */
export type RateLimiter = RateLimiterAbstract | BurstyRateLimiter

/**
 * The limit the headers report: a `BurstyRateLimiter`'s steady one, its main limiter -
 * found by its shape, as `rate-limiter-flexible` is only an optional peer of this hook.
 */
const steadyOf = (rateLimiter: RateLimiter): RateLimiterAbstract =>
  '_rateLimiter' in rateLimiter
    ? (rateLimiter._rateLimiter as RateLimiterAbstract)
    : (rateLimiter as RateLimiterAbstract)

/** A limiter's store may fail with an error instead of a `RateLimiterRes`. */
const isRateLimiterRes = (res: unknown): res is RateLimiterRes =>
  typeof (res as RateLimiterRes | undefined)?.msBeforeNext === 'number'

/**
 * Rate limits service method calls using `rate-limiter-flexible`.
 * You provide a pre-configured limiter (Memory, Redis, Mongo, etc., or a
 * `BurstyRateLimiter` for bursts) and the hook consumes points per request.
 *
 * @example
 * ```ts
 * import { rateLimit } from 'feathers-utils/hooks'
 * import { RateLimiterMemory } from 'rate-limiter-flexible'
 *
 * const rateLimiter = new RateLimiterMemory({ points: 10, duration: 1 })
 *
 * app.service('users').hooks({
 *   before: { find: [rateLimit(rateLimiter)] }
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/hooks/rate-limit.html
 */
export const rateLimit = <H extends HookContext = HookContext>(
  rateLimiter: RateLimiter,
  options?: RateLimitOptions<H>,
) => {
  const steady = steadyOf(rateLimiter)
  const key = options?.key ?? ((context: HookContext) => context.path)
  const points = options?.points ?? 1
  const headers = options?.headers ?? false
  const dryRun = options?.dryRun ?? false

  const infoFor = (res: RateLimiterRes, limited: boolean): RateLimitInfo => ({
    limit: steady.points,
    remaining: Math.max(0, res.remainingPoints),
    reset: Math.ceil(res.msBeforeNext / 1000),
    window: steady.duration,
    limited,
  })

  const headersFor = (info: RateLimitInfo, context: H) =>
    typeof headers === 'function'
      ? headers(info, context)
      : formats[headers as RateLimitHeaderFormat](info)

  const setHeaders = (context: H, values: Record<string, string>) => {
    context.http = {
      ...context.http,
      headers: { ...context.http?.headers, ...values },
    }
  }

  return async (context: H, next?: NextFunction): Promise<void> => {
    checkContext(context, { type: ['before', 'around'], label: 'rateLimit' })

    const resolvedKey = typeof key === 'function' ? await key(context) : key
    const resolvedPoints =
      typeof points === 'function' ? await points(context) : points

    try {
      const res = await rateLimiter.consume(resolvedKey, resolvedPoints)
      context.params = { ...context.params, rateLimit: res }
      if (headers) setHeaders(context, headersFor(infoFor(res, false), context))
    } catch (res) {
      // the error's `data` goes to the client: the limiter's answer - or a failing store's
      // error - stays here, for the server
      context.params = { ...context.params, rateLimit: res as RateLimiterRes }
      if (!isRateLimiterRes(res)) {
        throw new TooManyRequests('Too many requests')
      }
      const info = infoFor(res, true)
      await options?.onLimited?.(info, context)

      if (await resolveBoolean(dryRun, context, false)) {
        // through, as under the limit: nothing to wait for
        if (headers) setHeaders(context, headersFor(info, context))
      } else {
        const retryAfter = Math.ceil(res.msBeforeNext / 1000)
        const values = headers
          ? { ...headersFor(info, context), 'Retry-After': `${retryAfter}` }
          : undefined
        if (values) setHeaders(context, values)
        throw new TooManyRequests('Too many requests', {
          retryAfter,
          ...(values ? { headers: values } : {}),
        })
      }
    }

    if (next) await next()
  }
}
