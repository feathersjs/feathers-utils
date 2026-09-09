import { defineLoader } from 'vitepress'
import { discoverUtilities } from '../utilities.js'

/**
 * Every documented utility, across all categories — the tag pages are
 * cross-category by design, which is the whole point of the tag axis.
 */
export default defineLoader({
  async load() {
    return await discoverUtilities()
  },
  watch: ['src/**/*.md'],
})
