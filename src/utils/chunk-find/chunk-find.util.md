---
title: chunkFind
category: utils
tags:
  - query
  - batching
options: ChunkFindOptions
see:
  - utils/iterateFind
---

## Changing Items While Iterating

By default, `chunkFind` pages with `$skip`. When the loop changes items so that they no longer match the query, or others write to the service meanwhile, the pages shift: items are skipped or seen twice, without an error.

```ts
for await (const jobs of chunkFind(app, 'jobs', {
  params: { query: { status: 'pending' } },
  // pages by id instead of `$skip`, so every job comes exactly once
  keyset: true,
})) {
  const ids = jobs.map((job) => job.id)
  await app
    .service('jobs')
    .patch(null, { status: 'done' }, { query: { id: { $in: ids } } })
}
```

Without `keyset`, this loop leaves jobs `pending`: after the first page, those jobs no longer match, so `$skip` jumps over as many unprocessed ones.

With `keyset: true`, every page asks for the items after the last id of the page before. That also keeps large tables cheap, since the database no longer reads and discards every skipped row per page. The items come sorted by id, so `query.$sort` is not supported.
