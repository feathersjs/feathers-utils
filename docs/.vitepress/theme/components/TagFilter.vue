<template>
  <div v-if="groups.length" class="tag-filter my-4">
    <div
      v-for="group in groups"
      :key="group.label"
      class="flex flex-wrap items-center gap-2 mb-2"
    >
      <div
        class="opacity-60 text-sm w-20 shrink-0"
        :title="group.description"
      >
        {{ group.label }}
      </div>
      <Chip
        v-for="tag in group.tags"
        :key="tag"
        :label="tag"
        interactive
        :active="selected.includes(tag)"
        @click="emit('toggle', tag)"
      />
    </div>

    <div class="text-sm opacity-60 flex items-center gap-3">
      <span>{{ matchCount }} of {{ totalCount }}</span>
      <button
        v-if="selected.length"
        class="cursor-pointer underline"
        @click="emit('clear')"
      >
        Reset
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import Chip from "./Chip.vue";
import type { UtilityTag } from "../../tags";
import type { TagFilterGroup } from "../useTagFilter";

defineProps<{
  groups: TagFilterGroup[];
  selected: UtilityTag[];
  matchCount: number;
  totalCount: number;
}>();

const emit = defineEmits<{
  toggle: [tag: UtilityTag];
  clear: [];
}>();
</script>
