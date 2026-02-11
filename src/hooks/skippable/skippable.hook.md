---
title: skippable
category: hooks
hook:
  type: ["before", "after", "around"]
  method: ["all"]
  multi: true
predicates: true
see: ["predicates", "utils/addSkip"]
---

## Predicates

`skippable` is a utility function that wraps a hook to make it skippable based on a passed predicate. This is useful when you want to conditionally skip the execution of a hook based on certain criteria, such as the presence of a specific parameter in the context.

'feathers-utils' provides a set of predicates that can be used with this utility.

<PredicatesTable />
