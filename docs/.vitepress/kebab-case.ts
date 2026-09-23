/**
 * Converts an identifier to its kebab-case slug, which is what the docs use for
 * page paths, `see:` cross-links and option anchors.
 *
 * Words break at a lower→upper boundary, before the last capital of an acronym
 * run and around digit groups, so `gateParams` → `gate-params`,
 * `XMLHttpRequest` → `xml-http-request` and `v2Api` → `v-2-api`.
 */
export const kebabCase = (value: string): string =>
  (value.match(/[A-Z]{2,}(?=[A-Z][a-z]+|\b)|[A-Z]?[a-z]+|[A-Z]|\d+/g) ?? [])
    .map((word) => word.toLowerCase())
    .join('-')
