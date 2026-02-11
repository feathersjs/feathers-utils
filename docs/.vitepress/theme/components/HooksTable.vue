<template>
  <table class="hooks-table">
    <thead>
      <tr>
        <th class="text-left">Hook</th>
        <th class="text-left">Description</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="hook in filteredHooks" :ref="hook.name">
        <td>
          <a :href="hook.path">
            <code>{{ hook.name }}</code>
          </a>
        </td>
        <td v-html="md.render(hook.description)"></td>
      </tr>
    </tbody>
  </table>
</template>

<script setup lang="ts">
import Markdown from "markdown-it";
import { data as hooks } from "../hooks.data";
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    filter: (hook: (typeof hooks)[number]) => boolean;
  }>(),
  {
    filter: undefined,
  },
);

const filteredHooks = computed(() => {
  if (!props.filter) {
    return hooks;
  }

  const result = hooks.filter(props.filter);
  console.log(result);
  return result;
});

const md = new Markdown();
</script>

<style lang="scss">
table.hooks-table {
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
