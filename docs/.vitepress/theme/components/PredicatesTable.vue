<template>
  <table class="predicates-table">
    <thead>
      <tr>
        <th class="text-left">Predicate</th>
        <th class="text-left">Description</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="predicate in predicates" :ref="predicate.name">
        <td>
          <a :href="predicate.path">
            <code>{{ predicate.name }}</code>
          </a>
        </td>
        <td v-html="md.render(predicate.description)"></td>
      </tr>
    </tbody>
  </table>
</template>

<script setup lang="ts">
import Markdown from "markdown-it";
import { data as predicates } from "../predicates.data";

const md = new Markdown();
</script>

<style lang="scss">
table.predicates-table {
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
