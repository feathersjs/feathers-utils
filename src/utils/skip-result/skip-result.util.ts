import type { HookContext } from '@feathersjs/feathers'
import { isMulti, isPaginated } from '../../predicates/index.js'

/**
 * Set `context.result` to an empty array or object, depending on the hook type
 *
 * @see https://utils.feathersjs.com/utils/skip-result.html
 */
export const skipResult = <H extends HookContext = HookContext>(context: H) => {
  if (context.result) {
    return context
  }

  const multi = isMulti(context)

  if (multi) {
    if (context.method === 'find' && isPaginated(context)) {
      context.result = {
        total: 0,
        skip: 0,
        limit: 0,
        data: [],
      }
    } else {
      context.result = []
    }
  } else {
    context.result = null
  }

  return context
}
