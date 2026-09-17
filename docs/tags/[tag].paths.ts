import { defineRoutes } from 'vitepress'
import { utilityTagGroups, utilityTagPageContent } from '../.vitepress/tags'

export default defineRoutes({
  paths() {
    return utilityTagGroups.flatMap((group) =>
      group.tags.map((tag) => ({
        params: { tag: tag.name, description: tag.description },
        content: utilityTagPageContent(tag),
      })),
    )
  },
  // the pages themselves come from the vocabulary, but the tables on them are
  // built from the utilities' frontmatter
  watch: ['../../src/**/*.md', '../.vitepress/tags.ts'],
})
