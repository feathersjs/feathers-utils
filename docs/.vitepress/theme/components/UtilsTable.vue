<template>
  <table class="utils-table">
    <thead>
      <tr>
        <th class="text-left">Utility</th>
        <th class="text-left">Description</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="util in filteredUtils" :ref="util.name">
        <td>
          <a :href="util.path">
            <code>{{ util.name }}</code>
          </a>
        </td>
        <td v-html="md.render(util.description)"></td>
      </tr>
    </tbody>
  </table>
</template>

<script setup lang="ts">
import Markdown from "markdown-it";
import { data as utils } from "../utils.data";
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    filter: (util: (typeof utils)[number]) => boolean;
  }>(),
  {
    filter: undefined,
  },
);

const filteredUtils = computed(() => {
  if (!props.filter) {
    return utils;
  }

  const result = utils.filter(props.filter);
  return result;
});

const md = new Markdown();
</script>

<style lang="scss">
table.utils-table {
  p {
    margin-top: 0;
    margin-bottom: 0;

    line-height: 24px;
  }

  ul {
    margin-top: 8px;
    margin-bottom: 8px;
  }

  li + li {
    margin-top: 0;
  }
}
</style>
