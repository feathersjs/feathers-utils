---
title: aggregate
category: hooks
tags:
  - data
  - multi
  - relations
options: AggregateOptions
hook:
  type: ['before', 'after', 'around']
  method: ['create', 'update', 'patch', 'remove']
  multi: true
see:
  - hooks/denormalize
  - utils/count
  - utils/findAll
---

<!-- options -->

## The Counterpart of `denormalize`

| Hook                                     | Values come from    | Updated when                                  |
| ---------------------------------------- | ------------------- | --------------------------------------------- |
| [`generated`](/hooks/generated)          | the same item       | the item is written                           |
| [`denormalize`](/hooks/denormalize)      | **one** related item | its key or the related item changes          |
| `aggregate`                              | **many** child items | a child is created, removed, moved or changed |

The parent is not written by the call - a comment is. So `aggregate` sits on the service of the children and updates the parents from there.

## Which Parents It Updates

Every parent the call touched, before and after it: a `patch` that moves a child from one post to another updates both. Before an `update`, `patch` or `remove`, the id and the key of the children are fetched, once per call and [shared](/utils/get-merged-data) with `stash` and `trigger`. After the call, the key comes from the result - only if the `$select` of the call leaves it out, the children are fetched again.

## Computing From All Children

`compute` gets all parents of the call at once, so it can read their children with one query - say a `findAll` with `$in`, to sum an amount per parent. Computing from all children, rather than adding or subtracting with `$inc`, works with every adapter and keeps the values from drifting.
