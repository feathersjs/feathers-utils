---
title: isPromise
category: helpers
---

## Thenables

The check is `instanceof Promise`, so a custom thenable — an object with a
`then` method that is not a `Promise` — is `false`. Every `async` function
returns a native `Promise`, which covers hooks, predicates and service methods.
