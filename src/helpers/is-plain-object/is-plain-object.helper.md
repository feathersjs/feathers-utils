---
title: isPlainObject
category: helpers
see:
  - helpers/isEmptyObject
  - helpers/isEqual
---

## Coming from lodash

A drop-in for `_.isPlainObject`. The one difference: an object from another
realm (an `iframe`, `vm.runInNewContext`) has a different `Object.prototype`
and is `false` here.
