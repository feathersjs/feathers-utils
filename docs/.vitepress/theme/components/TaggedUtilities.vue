<template>
  <p v-if="!matches.length" class="opacity-60">
    Nothing is tagged <code>{{ tag }}</code> yet.
  </p>

  <table v-else class="tagged-table">
    <thead>
      <tr>
        <th class="text-left">Name</th>
        <th class="text-left">Category</th>
        <th class="text-left">Description</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="utility in matches" :key="utility.path">
        <td>
          <a :href="utility.path">
            <code>{{ utility.name }}</code>
          </a>
        </td>
        <td><Chip :label="utility.category" /></td>
        <td v-html="md.render(utility.description)"></td>
      </tr>
    </tbody>
  </table>
</template>

<script setup lang="ts">
import Markdown from "markdown-it";
import { computed } from "vue";
import { data as utilities } from "../all.data";
import { utilityCategories } from "../../utilities";
import Chip from "./Chip.vue";

const props = defineProps<{ tag: string }>();

// grouped by category, alphabetical within it — a flat alphabetical list across
// categories buries the fact that a tag usually has both a hook and a util
const matches = computed(() =>
  utilities
    .filter((utility) => utility.tags.includes(props.tag as never))
    .sort(
      (a, b) =>
        utilityCategories.indexOf(a.category) -
          utilityCategories.indexOf(b.category) ||
        a.title.localeCompare(b.title),
    ),
);

const md = new Markdown();
</script>

<style lang="scss">
table.tagged-table {
  p {
    margin-top: 0;
    margin-bottom: 0;

    line-height: 24px;
  }
}
</style>
