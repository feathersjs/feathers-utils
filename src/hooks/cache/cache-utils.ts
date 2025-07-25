import isObject from 'lodash/isObject.js'

export const stableStringify = (obj: Record<string, any>) => {
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
