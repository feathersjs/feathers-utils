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
import { discoverUtilities, utilityCategories } from './utilities'
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
  transformPageData(pageData) {
    const utility = utilities.find(
      (u) => `${u.category}/${u.slug}.md` === pageData.relativePath,
    )
    if (utility) {
      pageData.lastUpdated = utility.lastModified.getTime()
      pageData.filePath = utility.docsUrl.replace(
        `https://github.com/${repository}/blob/${mainBranch}/`,
        '',
      )
    } else {
      pageData.filePath = `docs/${pageData.relativePath}`
    }
  },
  themeConfig: {
    siteTitle: name,
    editLink: {
      pattern: `https://github.com/${repository}/edit/${mainBranch}/:path`,
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
      {
        text: 'Migrating',
        collapsed: false,
        items: [
          {
            text: 'from feathers-hooks-common',
            link: '/migrating-from-feathers-hooks-common',
          },
          {
            text: 'from @feathersjs/schema',
            link: '/migrating-from-feathers-schema',
          },
          {
            text: 'from feathers-fletching',
            link: '/migrating-from-feathers-fletching',
          },
        ],
      },
      {
        text: 'Hooks',
        link: '/hooks',
        collapsed: false,
        items: utilities
          .filter((x) => x.category === 'hooks' || x.hook)
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
        text: 'Resolvers',
        link: '/resolvers',
        collapsed: false,
        items: [
          ...utilities
            .filter(
              (x) =>
                x.category === 'resolvers' && x.frontmatter.kind !== 'helper',
            )
            .map((x) => ({
              text: x.title,
              link: x.path,
            })),
          {
            text: 'Helpers',
            collapsed: false,
            items: utilities
              .filter(
                (x) =>
                  x.category === 'resolvers' && x.frontmatter.kind === 'helper',
              )
              .map((x) => ({
                text: x.title,
                link: x.path,
              })),
          },
        ],
      },
      {
        text: 'Predicates',
        link: '/predicates',
        collapsed: false,
        items: utilities
          .filter((x) => x.category === 'predicates')
          .map((x) => ({
            text: x.title,
            link: x.path,
          })),
      },
      {
        text: 'Transformers',
        link: '/transformers',
        collapsed: false,
        items: utilities
          .filter((x) => x.category === 'transformers')
          .map((x) => ({
            text: x.title,
            link: x.path,
          })),
      },
      {
        text: 'Type Guards',
        link: '/guards',
        collapsed: false,
        items: utilities
          .filter((x) => x.category === 'guards')
          .map((x) => ({
            text: x.title,
            link: x.path,
          })),
      },
      { text: 'Utility Types', link: '/utility-types' },
    ],
    nav: [
      {
        text: 'Categories',
        items: [
          { text: 'Hooks', link: '/hooks' },
          { text: 'Utilities', link: '/utils' },
          { text: 'Resolvers', link: '/resolvers' },
          { text: 'Predicates', link: '/predicates' },
          { text: 'Transformers', link: '/transformers' },
          { text: 'Type Guards', link: '/guards' },
          { text: 'Utility Types', link: '/utility-types' },
        ],
      },
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
              ...utilityCategories.reduce(
                (acc, category) => {
                  acc[`feathers-utils/${category}`] = [
                    resolve(__dirname, `../../src/${category}/index.ts`),
                  ]
                  return acc
                },
                {} as Record<string, string[]>,
              ),
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
