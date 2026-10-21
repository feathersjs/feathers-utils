---
title: denormalize
category: hooks
tags:
  - data
  - multi
  - relations
options: DenormalizeOptions
see:
  - hooks/generated
  - hooks/aggregate
  - utils/patchMany
---

<!-- options -->

## The Two Hooks

| Hook     | Register on        | Methods                       | What it does                                                                 |
| -------- | ------------------ | ----------------------------- | ---------------------------------------------------------------------------- |
| `target` | the target service | `create`, `update`, `patch`   | fills the fields from the source item of `key`, with one query per call      |
| `source` | the source service | `update`, `patch`             | copies the fields that change to the target items, one `patchMany` each      |

`target` is a [`generated`](/hooks/generated) hook with `from: key`: a `patch` that leaves `key` alone reads no source item, a value the caller sends for a target field is overwritten, and a multi patch that gives the items different sources is written per group. Without a source item - `key` is `null`, or the source item doesn't exist - the fields are `null`.

## Why the Patches of `source` Pass

`source` patches the target items through their service, so their hooks run and their `patched` events are sent. But the `target` hook on that service only lets `generate` write the target fields - it would drop the values. So both hooks of one `denormalize` share a mark in `params`: the patches of `source` carry it, and `target` lets them pass unchanged.

A removed source item leaves the copied values in place - use [`onDelete`](/hooks/on-delete) to remove or unlink the target items.
