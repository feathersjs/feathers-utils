import { defineLoader } from 'vitepress'
import { discoverUtilities } from '../utilities'

export default defineLoader({
  async load() {
    return (await discoverUtilities()).filter(
      (utility) => utility.category === 'hooks' || utility.hook,
    )
  },
  watch: ['src/hooks/**/*.md', 'src/resolvers/**/*.md'],
})
