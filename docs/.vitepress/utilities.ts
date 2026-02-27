/* eslint-disable import-x/no-named-as-default-member */
import fs from 'node:fs/promises'
import matter from 'gray-matter'
import { glob } from 'tinyglobby'
import kebabCase from 'lodash/kebabCase.js'
import { mainBranch, repository } from './meta'
import type { Node } from 'typescript'
import ts from 'typescript'
import prettier from 'prettier'
import path from 'node:path'

export const utilityCategories = [
  'hooks',
  'utils',
  'resolvers',
  'predicates',
  'transformers',
  'guards',
] as const

export type UtilityCategory = (typeof utilityCategories)[number]

export type Utility = {
  name: string
  title: string
  description: string
  category: UtilityCategory
  slug: string
  path: string
  pathMd: string
  frontmatter: Record<string, any>
  content: string
  lastModified: Date
  sourceUrl: string
  docsUrl: string
  hook?: Record<string, any>
  transformers?: boolean
  predicates?: boolean
  dts: string
  examples?: string[]
  args?: {
    name: string
    type: string
    description: string
  }[]
}

const utilities = new Map<string, Utility>()
let utilitiesList: Utility[] = []

function typeDefinition(node: Node, name: string) {
  const descriptions: string[] = []
  const examples: string[] = []
  const args: NonNullable<Utility['args']> = []

  if (ts.isFunctionDeclaration(node) && node.name && node.name.text === name) {
    const jsDocTags = ts.getJSDocTags(node)
    const jsDocComments = ts.getJSDocCommentsAndTags(node)

    jsDocComments.forEach((doc) => {
      if (doc.comment) {
        descriptions.push(doc.comment)
      }
    })

    jsDocTags.forEach((tag) => {
      if (tag.tagName.text === 'example' && tag.comment) {
        examples.push(tag.comment)
      }
    })

    node.parameters.forEach((param) => {
      const name = param.name.getText()
      const type = param.type ? param.type.getText() : 'any'
      args.push({
        name,
        type,
        description: '',
      })
    })

    return {
      descriptions,
      examples,
      args,
    }
  } else if (ts.isVariableStatement(node)) {
    for (const decl of node.declarationList.declarations) {
      const nodeName = decl.name.getText()

      if (nodeName !== name) {
        continue
      }
      const jsDocTags = ts.getJSDocTags(decl)
      const jsDocComments = ts.getJSDocCommentsAndTags(decl)

      jsDocComments.forEach((doc) => {
        if (doc.comment) {
          descriptions.push(doc.comment)
        }
      })

      jsDocTags.forEach((tag) => {
        if (tag.tagName.text === 'example' && tag.comment) {
          examples.push(tag.comment)
        }
      })

      if (decl.initializer && ts.isArrowFunction(decl.initializer)) {
        decl.initializer.parameters.forEach((param) => {
          const paramName = param.name.getText()
          const type = param.type ? param.type.getText() : 'any'

          args.push({
            name: paramName,
            type,
            description: '',
          })
        })

        return {
          descriptions,
          examples,
          args,
        }
      }
    }
  }

  return undefined
}

function getDts2(mdFilePaths: string[]) {
  const tsFilePaths = mdFilePaths.map((filePath) =>
    filePath.replace(/\.md$/, '.ts'),
  )
  // Compiler options to emit only declarations (no JS)
  const compilerOptions: ts.CompilerOptions = {
    declaration: true,
    emitDeclarationOnly: true,
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
  }

  const result: Record<string, string> = {}

  const host = ts.createCompilerHost(compilerOptions)
  host.writeFile = async (fileName, contents) => {
    if (fileName.endsWith(`.d.ts`)) {
      const mdFile = mdFilePaths.find((path) =>
        fileName.endsWith(path.replace(/\.md$/, '.d.ts')),
      )
      if (!mdFile) {
        return
      }
      // Store the emitted .d.ts file in memory
      contents = contents
        .replace(/import\(.*?\)\./g, '')
        .replace(/import[\s\S]+?from ?["'][\s\S]+?["']/g, '')
        .replace(/export \{\}/g, '')

      result[mdFile] = (
        await prettier.format(contents, {
          semi: false,
          parser: 'typescript',
        })
      ).trim()
    }
  }

  // Create the program and emit
  const program = ts.createProgram(tsFilePaths, compilerOptions, host)
  program.emit()

  return result
}

export async function discoverUtilities() {
  const {
    srcDir = 'src',
    pattern = '**/*.md',
    exclude = ['**/node_modules/**', '**/dist/**'],
  } = {}

  const markdownFiles = await glob(`${srcDir}/${pattern}`, { ignore: exclude })
  utilities.clear()
  utilitiesList = []

  const dtsByMdFile = getDts2(markdownFiles)

  // console.log(markdownFiles)

  for (const filePath of markdownFiles) {
    try {
      // console.log(filePath)
      const content = await fs.readFile(filePath, 'utf-8')
      const fileName = path.basename(filePath, '.md')
      const { data: frontmatter, content: body } = matter(content)

      const { title = '', category, hook } = frontmatter

      if (
        !title ||
        [
          'hooks',
          'utils',
          'resolvers',
          'predicates',
          'transformers',
          'guards',
        ].indexOf(category) === -1
      ) {
        continue
      }

      const slug = kebabCase(title)

      const tsFile = filePath.replace(/\.md$/, '.ts')
      const tsContent = await fs.readFile(tsFile, 'utf-8').catch(() => null)
      if (!tsContent) {
        continue
      }

      const sourceFile = ts.createSourceFile(
        filePath,
        tsContent,
        ts.ScriptTarget.Latest,
        /*setParentNodes*/ true,
      )

      const descriptions: string[] = []
      const examples: string[] = []

      const args: NonNullable<Utility['args']> = []

      function visit(node: Node) {
        const def = typeDefinition(node, title)

        if (def) {
          descriptions.push(...def.descriptions)
          examples.push(...def.examples)
          args.push(...def.args)
        } else {
          ts.forEachChild(node, visit)
        }
      }

      visit(sourceFile)

      const utility: Utility = {
        name: title,
        title,
        description: descriptions.join(' '),
        category,
        slug,
        path: `/${category}/${slug}`,
        pathMd: `/${category}/${slug}.md`,
        frontmatter,
        content: body,
        hook,
        transformers: !!frontmatter.transformers,
        predicates: !!frontmatter.predicates,
        dts: dtsByMdFile[filePath] ?? undefined,
        lastModified: (await fs.stat(filePath)).mtime,
        examples: examples.length > 0 ? examples : undefined,
        args,
        sourceUrl: `https://github.com/${repository}/blob/${mainBranch}/src/${category}/${slug}/${fileName}.ts`,
        docsUrl: `https://github.com/${repository}/blob/${mainBranch}/src/${category}/${slug}/${fileName}.md`,
      }

      utilities.set(slug, utility)
      utilitiesList.push(utility)
    } catch (error) {
      console.warn(`Failed to process ${filePath}:`, error.message)
    }
  }

  utilitiesList.sort((a, b) => a.title.localeCompare(b.title))

  return utilitiesList
}
