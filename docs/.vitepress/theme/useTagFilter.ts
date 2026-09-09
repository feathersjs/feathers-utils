import { computed, ref } from 'vue'
import { utilityTagGroups, type UtilityTag } from '../tags.js'

export type TagFilterGroup = {
  label: string
  description: string
  tags: UtilityTag[]
}

/**
 * Tag filtering for a utility table.
 *
 * Selections combine as OR *within* a vocabulary group and AND *across* groups:
 * picking `query` and `data` widens to everything touching either, while adding
 * `validation` on top narrows to the validating ones among those. Plain AND over
 * a flat list would make the common "query or data" selection return almost
 * nothing, and plain OR would make cross-axis selections useless for narrowing.
 *
 * Counts are totals over the unfiltered list, so a chip's number does not move
 * while you click other chips.
 */
export function useTagFilter<T extends { tags: readonly UtilityTag[] }>(
  items: () => readonly T[],
) {
  const selected = ref<UtilityTag[]>([])

  const counts = computed(() => {
    const result = new Map<UtilityTag, number>()

    for (const item of items()) {
      for (const tag of item.tags) {
        result.set(tag, (result.get(tag) ?? 0) + 1)
      }
    }

    return result
  })

  // only offer tags that actually occur in this table
  const groups = computed<TagFilterGroup[]>(() =>
    utilityTagGroups
      .map((group) => ({
        label: group.label,
        description: group.description,
        tags: group.tags
          .map((tag) => tag.name)
          .filter((tag) => counts.value.has(tag)),
      }))
      .filter((group) => group.tags.length > 0),
  )

  const filtered = computed(() => {
    if (!selected.value.length) {
      return items()
    }

    return items().filter((item) =>
      groups.value.every((group) => {
        const inGroup = selected.value.filter((tag) => group.tags.includes(tag))

        return (
          inGroup.length === 0 || inGroup.some((tag) => item.tags.includes(tag))
        )
      }),
    )
  })

  const toggle = (tag: UtilityTag) => {
    selected.value = selected.value.includes(tag)
      ? selected.value.filter((x) => x !== tag)
      : [...selected.value, tag]
  }

  const clear = () => {
    selected.value = []
  }

  return { selected, counts, groups, filtered, toggle, clear }
}
