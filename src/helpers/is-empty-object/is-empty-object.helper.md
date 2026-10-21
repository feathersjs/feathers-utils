---
title: isEmptyObject
category: helpers
see:
  - helpers/isPlainObject
---

## Coming from lodash

`_.isEmpty` answers a broader question — it is `true` for `null`, `undefined`,
`[]`, `''`, `0` and any object without own string keys. `isEmptyObject` is only
`true` for `{}`, so check for a missing value first:

```ts
// before
if (_.isEmpty(query)) { ... }

// after
if (!query || isEmptyObject(query)) { ... }
```

An object that only carries symbol keys — a sequelize query like
`{ [Op.or]: [...] }` — is empty to `_.isEmpty`, but not to `isEmptyObject`.
