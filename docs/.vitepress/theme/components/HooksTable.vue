<template>
  <TagFilter
    v-if="tagFilter"
    :groups="groups"
    :selected="selected"
    :match-count="visible.length"
    :total-count="base.length"
    @toggle="toggle"
    @clear="clear"
  />

  <table class="hooks-table">
    <thead>
      <tr>
        <th class="text-left">Hook</th>
        <th class="text-left">Description</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="hook in visible" :ref="hook.name">
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
import TagFilter from "./TagFilter.vue";
import { useTagFilter } from "../useTagFilter";

const props = withDefaults(
  defineProps<{
    filter: (hook: (typeof hooks)[number]) => boolean;
    /**
     * Show the tag filter row. Opt-in, so the sub-tables embedded in generated
     * pages stay a plain list.
     */
    tagFilter?: boolean;
  }>(),
  {
    filter: undefined,
    tagFilter: false,
  },
);

const base = computed(() =>
  props.filter ? hooks.filter(props.filter) : hooks,
);

const { selected, groups, filtered, toggle, clear } = useTagFilter(
  () => base.value,
);

const visible = computed(() => (props.tagFilter ? filtered.value : base.value));

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
