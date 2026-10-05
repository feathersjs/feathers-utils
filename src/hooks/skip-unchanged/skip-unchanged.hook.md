---
title: skipUnchanged
category: hooks
tags:
  - data
  - multi
  - events
options: SkipUnchangedOptions
hook:
  type: ['before', 'around']
  method: ['patch']
  multi: true
see:
  - hooks/muteEvent
  - hooks/preventChanges
  - utils/getChanges
---

<!-- options -->

## When Nothing Changes

The patch is not written: `context.result` gets the stored items - with the `$select` of the call, as the patch would have returned them - and `context.event` is set to `null`, so no `patched` event is sent. The other hooks still run, the after hooks with that result.

## Comparing

A field of `data` replaces the stored one as a whole, so it is compared as a whole: `{ address: { city: 'Köln' } }` is a change if the stored `address` has more than `city`. Values are compared with `isDeepEqual`, so a date from the database and the same date as a string from a client count as a change - the field is written, nothing is lost.
