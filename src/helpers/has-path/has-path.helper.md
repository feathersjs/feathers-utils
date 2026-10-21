---
title: hasPath
category: helpers
see:
  - helpers/getPath
  - helpers/setPath
---

## Coming from lodash

A drop-in for `_.has`: only own properties count along the path. There is no
counterpart to `_.hasIn`, which also follows the prototype chain — `getPath(obj,
path) !== undefined` covers most of its uses.
