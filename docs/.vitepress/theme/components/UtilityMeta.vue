<template>
  <div
    class="grid grid-cols-[100px_auto] gap-x-4 gap-y-2 items-center mt-4 mb-8 text-sm"
  >
    <div class="opacity-60">Category</div>
    <div>
      <Chip :label="category" class="mr-2" />
      <a :href="sourceUrl" target="_blank" rel="noreferrer">Source Code</a> |
      <a :href="docsUrl" target="_blank" rel="noreferrer">Documentation</a>
    </div>

    <template v-if="tags.length">
      <div class="opacity-60">Tags</div>
      <div>
        <Chip
          v-for="tag in tags"
          :key="tag"
          :label="tag"
          :href="`/tags/${tag}.html`"
          class="mr-1"
        />
      </div>
    </template>

    <template v-if="size">
      <div class="opacity-60">Export size</div>
      <div>
        min {{ formatBytes(size.minified) }} · gzip {{ formatBytes(size.gzip) }}
      </div>
    </template>

    <template v-if="aliases.length">
      <div class="opacity-60">Aliases</div>
      <div>
        <template v-for="(alias, index) in aliases" :key="alias"
          ><span v-if="index">, </span><code>{{ alias }}</code></template
        >
      </div>
    </template>

    <template v-if="see.length">
      <div class="opacity-60">See also</div>
      <div>
        <a v-for="link in see" :key="link.label" :href="link.href" class="mr-2">
          <code>{{ link.label }}</code>
        </a>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * The meta grid under a utility page's title (VueUse-style): fixed label
 * column, value column.
 *
 * A component rather than markup the page generator writes out, so that the
 * search results stay readable: VitePress builds a hit's excerpt from whatever
 * follows the page's `<h1>`, by mounting the page without the theme's globally
 * registered components. This one resolves to nothing there, and the excerpt
 * starts with the description instead of with "Category / Tags / Export size".
 */
import type { Utility } from '../../utilities'
import type { UtilityTag } from '../../tags'
import type { BundleSize } from '../../export-size'

withDefaults(
  defineProps<{
    category: Utility['category']
    /** Link to the implementation on GitHub. */
    sourceUrl: string
    /** Link to the page's own `.md` on GitHub. */
    docsUrl: string
    tags?: UtilityTag[]
    /** Measured export size, absent when `dist/` was not built. */
    size?: BundleSize
    aliases?: string[]
    see?: { label: string; href: string }[]
  }>(),
  {
    tags: () => [],
    size: undefined,
    aliases: () => [],
    see: () => [],
  },
)

const formatBytes = (bytes: number) => `${(bytes / 1024).toFixed(2)} kB`
</script>
