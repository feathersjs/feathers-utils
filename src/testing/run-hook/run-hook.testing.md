---
title: runHook
category: testing
tags:
  - context
  - testing
options: RunHookOptions
see:
  - testing/expectNoSideEffects
  - testing/recordHooks
  - utils/checkContext
---

<!-- options -->

## The Stub Service

Without `service`, the hook runs on a stub with just the one method, which returns `result` or throws `error`. It has no options, so hooks that read the service's `multi`, `paginate` or `id` see their defaults. Pass a `MemoryService` with those options as `service` instead; then the method really runs, and `result` is whatever the adapter returns.

A hook that calls other services needs them on its app. Pass that app as `app`: the service is registered on it for the call and removed again afterwards, and the hooks of the app run as well.

## Not the `runHook` of feathers-hooks-common

`feathers-hooks-common` had a `runHook` that applied hooks to the result of a call, outside the hook chain. This one is only for tests: it runs a hook in isolation and gives you the context.
