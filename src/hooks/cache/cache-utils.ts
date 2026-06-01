import { sortQueryProperties } from '../../utils/sort-query-properties/sort-query-properties.util.js'

export { sortQueryProperties }

export const stableStringify = (obj: Record<string, any>) => {
  // Canonicalize the whole params object once (recursive key-sort + operator-array
  // sort). The JSON.stringify pass then only needs to reject non-JSON values
  // instead of re-sorting and re-allocating every node.
  const normalized = sortQueryProperties(obj as any)

  return JSON.stringify(normalized, (_key, value) => {
    if (typeof value === 'function') {
      throw new Error('Cannot stringify non JSON value')
    }
    return value
  })
}
