---
aside: false
---

# Testing

Helpers for testing a Feathers application: assert what a service was actually
asked to do, and wait for what it does asynchronously.

They ship in their own entry point so test-only code never rides along in a
production bundle:

```ts
import { recordHooks } from 'feathers-utils/testing'
```

<TestingTable />
