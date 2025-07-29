import { defineConfig } from 'vitepress'
import {
  name,
  description,
  ogUrl,
  ogImage,
  repository,
  mainBranch,
} from './meta'
import { version } from '../../package.json'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { discoverUtilities } from './utilities'
import { MarkdownTransform } from './plugins/markdownTransform'
import { transformerTwoslash } from '@shikijs/vitepress-twoslash'
import tailwindcss from '@tailwindcss/vite'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const utilities = await discoverUtilities()

export default defineConfig({
  title: name,
  lastUpdated: true,
  description: '',
  head: [
    ['meta', { name: 'theme-color', content: '#ae0bb1' }],
    ['link', { rel: 'icon', href: '/feathers-utils-logo.png' }],
    ['meta', { property: 'og:title', content: name }],
    ['meta', { property: 'og:description', content: description }],
    ['meta', { property: 'og:url', content: ogUrl }],
    ['meta', { property: 'og:image', content: ogImage }],
    ['meta', { name: 'twitter:title', content: name }],
    ['meta', { name: 'twitter:description', content: description }],
    ['meta', { name: 'twitter:image', content: ogImage }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
  ],
  themeConfig: {
    siteTitle: name,
    editLink: {
      pattern: `https://github.com/${repository}/edit/${mainBranch}/docs/:path`,
    },
    lastUpdatedText: 'Last Updated',
    socialLinks: [
      {
        icon: 'discord',
        link: 'https://discord.gg/qa8kez8QBx',
      },
      {
        icon: 'github',
        link: `https://github.com/${repository}`,
      },
    ],
    logo: '/feathers-utils-logo.png',
    sidebar: [
      { text: 'Overview', link: '/overview' },
      { text: 'Why moving from feathers-hooks-common', link: '/why' },
      { text: 'Migrating', link: '/migrating-from-feathers-hooks-common' },
      {
        text: 'Hooks',
        link: '/hooks',
        collapsed: false,
        items: utilities
          .filter((x) => x.category === 'hooks')
          .map((x) => ({
            text: x.title,
            link: x.path,
          })),
      },
      {
        text: 'Utilities',
        link: '/utils',
        collapsed: false,
        items: utilities
          .filter((x) => x.category === 'utils')
          .map((x) => ({
            text: x.title,
            link: x.path,
          })),
      },
      {
        text: 'Predicates',
        link: '/predicates',
      },
      {
        text: 'Transformers',
        link: '/transformers',
      },
      { text: 'Utility Types', link: '/utility-types' },
    ],
    nav: [
      {
        text: `v${version}`,
        items: [
          {
            text: 'Changelog',
            link: `https://github.com/${repository}/blob/${mainBranch}/CHANGELOG.md`,
          },
          {
            text: 'Contributing',
            link: `https://github.com/${repository}/blob/${mainBranch}/.github/contributing.md`,
          },
        ],
      },
    ],
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2016-present Feathers contributors',
    },
    search: {
      provider: 'local',
    },
  },
  markdown: {
    codeTransformers: [
      transformerTwoslash({
        twoslashOptions: {
          compilerOptions: {
            paths: {
              'feathers-utils': [resolve(__dirname, '../../src/index.ts')],
              'feathers-utils/hooks': [
                resolve(__dirname, '../../src/hooks/index.ts'),
              ],
              'feathers-utils/utils': [
                resolve(__dirname, '../../src/utils/index.ts'),
              ],
              'feathers-utils/predicates': [
                resolve(__dirname, '../../src/predicates/index.ts'),
              ],
              'feathers-utils/resolvers': [
                resolve(__dirname, '../../src/resolvers/index.ts'),
              ],
              'feathers-utils/transformers': [
                resolve(__dirname, '../../src/transformers/index.ts'),
              ],
            },
          },
        },
      }),
    ],
    // Explicitly load these languages for types hightlighting
    languages: ['js', 'ts'],
  },
  vite: {
    server: {
      fs: {
        allow: [resolve(__dirname, '../../src')],
      },
    },
    plugins: [
      MarkdownTransform({
        vitepressDirectory: resolve(__dirname, '../'),
      }),
      tailwindcss(),
    ],
  },
})
