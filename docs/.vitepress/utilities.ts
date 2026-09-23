/* eslint-disable import-x/no-named-as-default-member */
import fs from 'node:fs/promises'
import matter from '@11ty/gray-matter'
import { glob } from 'tinyglobby'
import { kebabCase } from './kebab-case.js'
import { mainBranch, repository } from './meta.js'
import type { Node } from 'typescript'
import ts from 'typescript'
import prettier from 'prettier'
import path from 'node:path'
import { attachExportSizes, type BundleSize } from './export-size.js'
import { isUtilityTag, utilityTags, type UtilityTag } from './tags.js'
import { utilityCategories, type UtilityCategory } from './categories.js'

export type Utility = {
  name: string
  title: string
  description: string
  category: UtilityCategory
  /**
   * The page's `tags` frontmatter, narrowed to the closed vocabulary in
   * `tags.ts` and ordered by it. Unknown tags are dropped here; `test/tags.test.ts`
   * is what keeps them from being written in the first place.
   */
  tags: UtilityTag[]
  slug: string
  path: string
  pathMd: string
  frontmatter: Record<string, any>
  content: string
  lastModified: Date
  sourceUrl: string
  docsUrl: string
  /**
   * Absolute path of the sibling `.ts` file the page's prose is generated from.
   */
  sourceFilePath: string
  /**
   * Absolute path of the `.md` file the page's frontmatter and body come from.
   */
  mdFilePath: string
  hook?: Record<string, any>
  transformers?: boolean
  predicates?: boolean
  dts: string
  bundleSize?: BundleSize
  examples?: string[]
  aliases?: string[]
  args?: {
    name: string
    type: string
    description: string
  }[]
  /**
   * The options type(s) named in the page's `options` frontmatter, read from the
   * sibling `.ts` file — so what a page documents is generated from the type
   * instead of being hand-maintained beside it.
   */
  options?: UtilityOptionGroup[]
}

export type UtilityOptionGroup = {
  /** The name of the type the members were read from. */
  type: string
  members: UtilityOption[]
}

export type UtilityOption = {
  name: string
  /** The member's type, as written in the source. */
  type: string
  optional: boolean
  /** The `@default` tag's value, if the member documents one. */
  default?: string
  /** The member's JSDoc description, paragraphs kept as blank lines. */
  description: string
  /** The member's `@example` blocks. */
  examples?: string[]
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
      const comment = ts.getTextOfJSDocComment(doc.comment)
      if (comment) {
        descriptions.push(comment)
      }
    })

    jsDocTags.forEach((tag) => {
      const comment = ts.getTextOfJSDocComment(tag.comment)
      if (tag.tagName.text === 'example' && comment) {
        examples.push(comment)
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
        const comment = ts.getTextOfJSDocComment(doc.comment)
        if (comment) {
          descriptions.push(comment)
        }
      })

      jsDocTags.forEach((tag) => {
        const comment = ts.getTextOfJSDocComment(tag.comment)
        if (tag.tagName.text === 'example' && comment) {
          examples.push(comment)
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

/**
 * Reads the members of an options type (`type X = { … }` or `interface X { … }`)
 * declared in `sourceFile`, so a page can document its options straight from
 * the type. Returns `undefined` when no such type is declared in the file.
 */
function optionsFromType(
  sourceFile: ts.SourceFile,
  typeName: string,
): UtilityOption[] | undefined {
  let members: ts.NodeArray<ts.TypeElement> | undefined

  sourceFile.forEachChild((node) => {
    if (members) {
      return
    }

    if (ts.isInterfaceDeclaration(node) && node.name.text === typeName) {
      members = node.members
    } else if (
      ts.isTypeAliasDeclaration(node) &&
      node.name.text === typeName &&
      ts.isTypeLiteralNode(node.type)
    ) {
      members = node.type.members
    }
  })

  if (!members) {
    return undefined
  }

  const options: UtilityOption[] = []

  for (const member of members) {
    if (!ts.isPropertySignature(member)) {
      continue
    }

    const descriptions: string[] = []
    const examples: string[] = []
    let defaultValue: string | undefined

    ts.getJSDocCommentsAndTags(member).forEach((doc) => {
      if (!ts.isJSDoc(doc)) {
        return
      }
      const comment = ts.getTextOfJSDocComment(doc.comment)
      if (comment) {
        descriptions.push(comment)
      }
    })

    ts.getJSDocTags(member).forEach((tag) => {
      const comment = ts.getTextOfJSDocComment(tag.comment)
      if (!comment) {
        return
      }
      if (tag.tagName.text === 'example') {
        examples.push(comment)
      } else if (
        tag.tagName.text === 'default' ||
        tag.tagName.text === 'defaultValue'
      ) {
        defaultValue = comment.trim()
      }
    })

    options.push({
      name: member.name.getText(),
      // a multi-line type (a long function signature, an inline object) is
      // collapsed onto the signature line it is rendered into
      type: (member.type?.getText() ?? 'any')
        .replace(/\s+/g, ' ')
        .replace(/([([{])\s+/g, '$1')
        .replace(/\s+([)\]}])/g, '$1')
        .replace(/\s+([,;])/g, '$1')
        // a trailing comma prettier wrapped onto its own line
        .replace(/,([)\]}])/g, '$1'),
      optional: !!member.questionToken,
      default: defaultValue,
      description: descriptions.join('\n\n'),
      examples: examples.length > 0 ? examples : undefined,
    })
  }

  return options
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

      const {
        title = '',
        category,
        hook,
        aliases,
        options: optionsType,
      } = frontmatter

      const tags = (Array.isArray(frontmatter.tags) ? frontmatter.tags : [])
        .filter(isUtilityTag)
        .sort((a, b) => utilityTags.indexOf(a) - utilityTags.indexOf(b))

      if (!title || !utilityCategories.includes(category)) {
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

      // `options:` takes one type name or a list of them, for a page that
      // documents more than one (e.g. a util and the predicate beside it)
      const optionTypeNames: string[] = Array.isArray(optionsType)
        ? optionsType
        : optionsType
          ? [optionsType]
          : []

      const options = optionTypeNames.flatMap((typeName) => {
        const members = optionsFromType(sourceFile, typeName)

        if (!members?.length) {
          console.warn(
            `${filePath}: frontmatter \`options: ${typeName}\` does not match a type in ${path.basename(tsFile)}`,
          )
          return []
        }

        return [{ type: typeName, members }]
      })

      const utility: Utility = {
        name: title,
        title,
        description: descriptions.join(' '),
        category,
        tags,
        slug,
        path: `/${category}/${slug}`,
        pathMd: `/${category}/${slug}.md`,
        frontmatter,
        content: body,
        hook,
        transformers: !!frontmatter.transformers,
        predicates: !!frontmatter.predicates,
        aliases: aliases?.length ? aliases : undefined,
        dts: dtsByMdFile[filePath] ?? undefined,
        lastModified: (await fs.stat(filePath)).mtime,
        examples: examples.length > 0 ? examples : undefined,
        args,
        options: options?.length ? options : undefined,
        sourceFilePath: path.resolve(tsFile),
        mdFilePath: path.resolve(filePath),
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

  await attachExportSizes(utilitiesList)

  return utilitiesList
}
