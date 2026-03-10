import isObject from 'lodash/isObject.js'
import { sortQueryProperties } from '../../utils/sort-query-properties/sort-query-properties.util.js'

export { sortQueryProperties }

export const stableStringify = (obj: Record<string, any>) => {
  if (obj.query) {
    obj = { ...obj, query: sortQueryProperties(obj.query) }
  }

  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'function') {
      throw new Error('Cannot stringify non JSON value')
    }

    if (isObject(value)) {
      return Object.keys(value)
        .sort()
        .reduce(
          (result, key) => {
            result[key] = (value as any)[key]
            return result
          },
          {} as Record<string, any>,
        )
    }

    return value
  })
}
