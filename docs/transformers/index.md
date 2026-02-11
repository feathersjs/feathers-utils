---
---

# Transformers

Transformers are functions that modify the data or result of a Feathers service call. They can be used to apply transformations such as trimming strings, converting dates, or omitting fields from the data or result.

## Built-in Transformers

<TransformersTable />

## Hooks that are meant to be used with transformers:

<HooksTable :filter="(hook) => hook.transformers" />

## Utilities that are meant to be used with transformers:

<UtilsTable :filter="(util) => util.transformers" />
