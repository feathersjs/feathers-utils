import { discoverUtilities } from '../.vitepress/utilities'
import { defineRoutes } from 'vitepress'

export default defineRoutes({
  async paths() {
    const utilities = (await discoverUtilities()).filter(
      (utility) => utility.category === 'resolvers',
    )

    return utilities.map((utility) => ({
      params: { slug: utility.slug },
      content: utility.content,
    }))
  },
  watch: ['src/resolvers/**/*.md'],
})
