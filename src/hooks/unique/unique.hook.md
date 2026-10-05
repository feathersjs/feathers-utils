---
title: unique
category: hooks
tags:
  - data
  - validation
  - multi
options: UniqueOptions
hook:
  type: ['before', 'around']
  method: ['create', 'update', 'patch']
  multi: true
see:
  - utils/getMergedData
  - hooks/generated
  - hooks/findOrCreate
---

<!-- options -->

## Like a Unique Index

| Postgres                                          | `unique`                                  |
| ------------------------------------------------- | ----------------------------------------- |
| `UNIQUE (tenant_id, email)`                       | `fields: ['tenantId', 'email']`           |
| `... WHERE deleted_at IS NULL` (partial index)    | `where: { deletedAt: null }`              |
| `NULL` values never conflict                      | items with a `null` field are not checked |
| `NULLS NOT DISTINCT`                              | `nullsNotDistinct: true`                  |

`where` applies to both sides: a new item that doesn't match it is not checked, and a stored item that doesn't match it can't conflict. A `patch` that makes an item match `where`, such as restoring a deleted one with `{ deletedAt: null }`, is checked as well.

## What It Checks

Only the items whose values change. If the stored items were fetched anyway, an item whose `fields` and `where` fields stay as they are is skipped - it was checked when it got them - and stays among the stored items the others are checked against. If no item changes, nothing is queried. Values are compared by content - a bson `ObjectId` as well; a class that keeps its value in `#private` fields would look unchanged.

- **The items of the call among themselves**: two items of a multi `create`, or a multi `patch` that gives several items the same values.
- **The stored items**, apart from those the call changes: one query for all items of the call, with the `_find` of the adapter, so the hooks of `find` don't hide conflicts. It gets the params of the call without its `provider`, so a transaction passed in `params` covers it. With `underscore: false`, and for a service without `_find`, it is queried with `find`, through the hooks of the service.

## Not a Replacement for the Index

Two calls that run at the same time can both pass the check before either has written. Only a unique index in the database rules that out. `unique` gives you the check for adapters without one, for conditions the database can't express, and a clean `Conflict` instead of a database error.
