---
title: iterateFind
category: utils
tags:
  - query
  - batching
options: IterateFindOptions
see:
  - utils/chunkFind
---

## Changing Items While Iterating

By default, `iterateFind` pages with `$skip`. When the loop changes items so that they no longer match the query, or others write to the service meanwhile, the pages shift: items are skipped or seen twice, without an error.

```ts
for await (const job of iterateFind(app, 'jobs', {
  params: { query: { status: 'pending' } },
  // pages by id instead of `$skip`, so every job comes exactly once
  keyset: true,
})) {
  await app.service('jobs').patch(job.id, { status: 'done' })
}
```

Without `keyset`, this loop leaves jobs `pending`: after the first page, those jobs no longer match, so `$skip` jumps over as many unprocessed ones.

With `keyset: true`, every page asks for the items after the last id of the page before. That also keeps large tables cheap, since the database no longer reads and discards every skipped row per page. The items come sorted by id, so `query.$sort` is not supported.
