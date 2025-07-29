---
---

# Predicates

Predicates are functions that return a boolean value based on the context of a Feathers service call. They can be used to conditionally execute hooks or logic based on the state of the request, such as whether the user is authenticated, if the data is an array, or any other custom condition you define.

Hooks that are meant to be used with predicates:

- [iff](/hooks/iff.html): Executes a hook if the predicate returns true.
- [iffElse](/hooks/iff-else.html): Executes one hook if the predicate returns true, and another if it returns false.
- [unless](/hooks/unless.html): Executes a series of hooks if the predicate returns false.
- [skippable](/hooks/skippable.html): Allows you to skip the execution of a hook based on a predicate.
- [throwIf](/hooks/throw-if.html): Throws an error if the predicate returns true.

<PredicatesList />

## Custom Predicates

You can easily create custom predicates like:

```ts
const isSingleData = (context) => !Array.isArray(context.data);
```

or

```ts
const isAuthenticated = (context) => !!context.params?.authenticated;
```
