---
---

# Transformers

Transformers are functions that modify the data or result of a Feathers service call. They can be used to apply transformations such as trimming strings, converting dates, or omitting fields from the data or result.

Hooks that are meant to be used with transformers:

- [transformData](/hooks/transform-data.html): Transforms the data before it is sent to the database.
- [transformResult](/hooks/transform-result.html): Transforms the result after it has been retrieved from the database.
- [transformQuery](/hooks/transform-query.html): Transforms the query parameters before they are sent to the database.

Utils that are meant to be used with transformers:

- [mutateData](/utils/mutate-data.html): Utility functions to mutate the data.
- [mutateResult](/utils/mutate-result.html): Utility functions to mutate the result.

<TransformersList />
