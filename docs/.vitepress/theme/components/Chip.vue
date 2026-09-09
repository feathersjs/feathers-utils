<template>
  <component
    :is="href ? 'a' : interactive ? 'button' : 'div'"
    :href="href"
    :title="resolvedTitle"
    :aria-pressed="interactive ? active : undefined"
    class="text-sm rounded-full inline-block px-3 py-1 no-underline!"
    :class="[
      colorClass,
      href || interactive ? 'cursor-pointer' : '',
      interactive && !active ? 'opacity-55 hover:opacity-100' : '',
      interactive && active
        ? 'ring-2 ring-offset-1 ring-offset-(--vp-c-bg) ring-current'
        : '',
    ]"
  >
    {{ label }}
  </component>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Utility } from "../../utilities";
import {
  isUtilityTag,
  utilityTagDescriptions,
  utilityTagGroupOf,
  type UtilityTag,
} from "../../tags";

const props = withDefaults(
  defineProps<{
    label: Utility["category"] | UtilityTag;
    /** Renders the chip as a link. */
    href?: string;
    /** Renders the chip as a toggle button, dimmed while not `active`. */
    interactive?: boolean;
    active?: boolean;
    title?: string;
  }>(),
  {
    href: undefined,
    interactive: false,
    active: false,
    title: undefined,
  },
);

// categories get the saturated colors they always had; tags are secondary and
// share one soft color per vocabulary group, so a filter row reads as a group
// instead of a rainbow
const categoryColors: Record<string, string> = {
  hooks: "bg-(--vp-c-brand) text-(--vp-button-brand-text)",
  utils: "bg-sky-700 text-white",
  predicates: "bg-emerald-600 text-white",
  guards: "bg-amber-600 text-white",
  transformers: "bg-pink-600 text-white",
  resolvers: "bg-violet-600 text-white",
};

const tagGroupColors: Record<string, string> = {
  Context: "bg-sky-500/15 text-sky-800 dark:bg-sky-400/15 dark:text-sky-200",
  Topic:
    "bg-violet-500/15 text-violet-800 dark:bg-violet-400/15 dark:text-violet-200",
};

const colorClass = computed(() => {
  if (props.label in categoryColors) {
    return categoryColors[props.label];
  }

  if (isUtilityTag(props.label)) {
    return (
      tagGroupColors[utilityTagGroupOf[props.label]] ??
      "bg-slate-500/15 text-slate-800 dark:text-slate-200"
    );
  }

  return "bg-slate-500/15 text-slate-800 dark:text-slate-200";
});

// the vocabulary descriptions are markdown (they render as prose on the tag
// pages); a title attribute shows backticks literally, so drop them here
const resolvedTitle = computed(() =>
  props.title ??
  (isUtilityTag(props.label)
    ? utilityTagDescriptions[props.label].replace(/`/g, "")
    : undefined),
);
</script>
