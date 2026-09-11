<template>
  <table class="testing-table">
    <thead>
      <tr>
        <th class="text-left">Utility</th>
        <th class="text-left">Description</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="utility in utilities" :ref="utility.name">
        <td>
          <a :href="utility.path">
            <code>{{ utility.name }}</code>
          </a>
        </td>
        <td v-html="md.render(utility.description)"></td>
      </tr>
    </tbody>
  </table>
</template>

<script setup lang="ts">
import Markdown from "markdown-it";
import { data as utilities } from "../testing.data";

const md = new Markdown();
</script>

<style lang="scss">
table.testing-table {
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
