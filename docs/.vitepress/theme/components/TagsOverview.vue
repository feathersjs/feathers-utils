<template>
  <div
    v-for="group in groups"
    :key="group.label"
    class="mb-8"
  >
    <h2 :id="group.label.toLowerCase()">{{ group.label }}</h2>
    <p class="opacity-70">{{ group.description }}</p>

    <div
      class="grid grid-cols-[minmax(0,10rem)_auto] gap-x-4 gap-y-3 items-center text-sm"
    >
      <template v-for="tag in group.tags" :key="tag.name">
        <div>
          <Chip :label="tag.name" :href="`/tags/${tag.name}.html`" />
        </div>
        <div>
          <span v-html="md.renderInline(tag.description)" />
          <span class="opacity-50"> ({{ counts.get(tag.name) ?? 0 }})</span>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import Markdown from "markdown-it";
import { computed } from "vue";
import { data as utilities } from "../all.data";
import { utilityTagGroups, type UtilityTag } from "../../tags";
import Chip from "./Chip.vue";

const groups = utilityTagGroups;

const md = new Markdown();

const counts = computed(() => {
  const result = new Map<UtilityTag, number>();

  for (const utility of utilities) {
    for (const tag of utility.tags) {
      result.set(tag, (result.get(tag) ?? 0) + 1);
    }
  }

  return result;
});
</script>
