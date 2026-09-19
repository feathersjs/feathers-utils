---
aside: false
---

# Channels

Helpers for writing an `app.publish` publisher that composes with another one.

They normalize the four shapes a publisher may return into a flat list of leaf
channels, narrow that list without destroying the payload a channel carries for
its connections, and turn it back into something Feathers dispatches correctly -
either by hand, or as a chain of publishers.

They ship in their own entry point, because they need
`@feathersjs/transport-commons` - which only an app with a realtime transport
has installed:

```ts
import { chainChannels } from 'feathers-utils/channels'
```

<ChannelsTable />
