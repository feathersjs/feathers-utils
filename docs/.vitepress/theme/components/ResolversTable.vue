<template>
  <table class="resolvers-table">
    <thead>
      <tr>
        <th class="text-left">Resolver</th>
        <th class="text-left">Description</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="resolver in filteredResolvers" :ref="resolver.name">
        <td>
          <a :href="resolver.path">
            <code>{{ resolver.name }}</code>
          </a>
        </td>
        <td v-html="md.render(resolver.description)"></td>
      </tr>
    </tbody>
  </table>
</template>

<script setup lang="ts">
import Markdown from "markdown-it";
import { data as resolvers } from "../resolvers.data";
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    filter: (resolver: (typeof resolvers)[number]) => boolean;
  }>(),
  {
    filter: undefined,
  },
);

const filteredResolvers = computed(() => {
  if (!props.filter) {
    return resolvers;
  }

  return resolvers.filter(props.filter);
});

const md = new Markdown();
</script>

<style lang="scss">
table.resolvers-table {
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
