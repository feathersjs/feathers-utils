import { defineLoader } from 'vitepress'
import { discoverUtilities } from '../utilities.js'

export default defineLoader({
  async load() {
    return (await discoverUtilities()).filter(
      (utility) => utility.category === 'guards',
    )
  },
  watch: ['src/guards/**/*.md'],
})
