<template>
  <table class="conditions-table">
    <thead>
      <tr>
        <th class="text-left">Condition</th>
        <th class="text-left">Description</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="condition in conditions" :ref="condition.name">
        <td>
          <a :href="condition.path">
            <code>{{ condition.name }}</code>
          </a>
        </td>
        <td v-html="md.render(condition.description)"></td>
      </tr>
    </tbody>
  </table>
</template>

<script setup lang="ts">
import Markdown from "markdown-it";
import { data as resolvers } from "../resolvers.data";
import { computed } from "vue";

const conditions = computed(() => {
  return resolvers.filter((r) => r.frontmatter.kind === 'condition');
});

const md = new Markdown();
</script>

<style lang="scss">
table.conditions-table {
  p {
    margin-top: 0;
    margin-bottom: 0;
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
