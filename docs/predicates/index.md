---
---

# Predicates

Predicates are functions that return a boolean value based on the context of a Feathers service call. They can be used to conditionally execute hooks or logic based on the state of the request, such as whether the user is authenticated, if the data is an array, or any other custom condition you define.

## Built-in Predicates

<PredicatesTable />

## Hooks that are meant to be used with predicates

<HooksTable :filter="(hook) => hook.predicates" />

## Custom Predicates

You can easily create custom predicates like:

```ts
const isSingleData = (context) => !Array.isArray(context.data);
```

or

```ts
const isAuthenticated = (context) => !!context.params?.authenticated;
```
