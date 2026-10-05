---
aside: false
---

# Testing

Helpers for testing a Feathers application: run a hook in isolation, check that
it leaves the caller's params alone, assert what a service was actually asked to
do, and wait for what it does asynchronously.

They ship in their own entry point so test-only code never rides along in a
production bundle:

```ts
import { expectNoSideEffects, recordHooks, runHook } from 'feathers-utils/testing'
```

<TestingTable />
