<template>
  <table class="guards-table">
    <thead>
      <tr>
        <th class="text-left">Type Guard</th>
        <th class="text-left">Description</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="guard in guards" :ref="guard.name">
        <td>
          <a :href="guard.path">
            <code>{{ guard.name }}</code>
          </a>
        </td>
        <td v-html="md.render(guard.description)"></td>
      </tr>
    </tbody>
  </table>
</template>

<script setup lang="ts">
import Markdown from "markdown-it";
import { data as guards } from "../guards.data";

const md = new Markdown();
</script>

<style lang="scss">
table.guards-table {
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
