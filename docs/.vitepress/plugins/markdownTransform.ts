import type { Plugin } from 'vite'

import { discoverUtilities, type Utility } from '../utilities'
import md from './utility'

export type MarkdownTransformOptions = {
  vitepressDirectory: string
}

export function MarkdownTransform(options: MarkdownTransformOptions): Plugin {
  const { vitepressDirectory } = options

  let utilitiesList: Utility[] = []

  return {
    name: 'feathers-commons-md-transform',
    enforce: 'pre',
    async buildStart() {
      const result = await discoverUtilities()
      utilitiesList = result
    },
    async transform(code, id) {
      if (!id.match(/\.md\b/)) return null

      const slug = id.replace(vitepressDirectory, '')

      const utility = utilitiesList.find((x) => x.pathMd === slug)
      if (!utility) {
        return null
      }

      const result = md(utility)

      return result
    },
  }
}
