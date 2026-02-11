<template>
  <div
    class="text-sm rounded-full inline-block px-3 py-1"
    :class="{
      'bg-(--vp-c-brand) text-(--vp-button-brand-text)': label === 'hooks',
      'bg-sky-700 text-white': label === 'utils',
      'bg-emerald-600 text-white': label === 'predicates',
      'bg-amber-600 text-white': label === 'guards',
      'bg-pink-600 text-white': label === 'transformers',
    }"
  >
    {{ label }}
  </div>
</template>

<script setup lang="ts">
import { Utility } from "../../utilities";

const props = withDefaults(
  defineProps<{
    label: Utility["category"];
  }>(),
  {},
);
</script>
