import { toArray, type MaybeArray } from '../../internal.utils.js'
import _get from 'lodash/get.js'
import _set from 'lodash/set.js'

export const parseDate = (fieldNames: MaybeArray<string>) => {
  const fieldNamesArr = toArray(fieldNames)

  return (item: any) => {
    for (let i = 0, len = fieldNamesArr.length; i < len; i++) {
      const key = fieldNamesArr[i]
      const value = _get(item, key)
      if (value) {
        _set(item, key, new Date(value))
      }
    }
  }
}
