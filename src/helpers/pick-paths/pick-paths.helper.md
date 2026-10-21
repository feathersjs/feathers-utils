---
title: pickPaths
category: helpers
see:
  - helpers/omitPaths
  - helpers/getPath
  - transformers/pick
---

## Coming from lodash

A drop-in for `_.pick`: a nested path builds a nested result, a path that does
not resolve is skipped, and a key that exists but holds `undefined` is kept.

To pick fields of `context.data` or `context.result` inside a hook, prefer the
[`pick`](/transformers/pick) transformer.
