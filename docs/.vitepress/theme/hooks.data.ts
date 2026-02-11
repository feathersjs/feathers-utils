import { defineLoader } from 'vitepress'
import { discoverUtilities } from '../utilities'

export default defineLoader({
  async load() {
    return (await discoverUtilities()).filter(
      (utility) => utility.category === 'hooks',
    )
  },
  watch: ['src/hooks/**/*.md'],
})
