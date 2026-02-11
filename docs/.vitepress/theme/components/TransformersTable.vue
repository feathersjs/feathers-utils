<template>
  <table class="transformers-table">
    <thead>
      <tr>
        <th class="text-left">Transformer</th>
        <th class="text-left">Description</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="transformer in transformers" :ref="transformer.name">
        <td>
          <a :href="transformer.path">
            <code>{{ transformer.name }}</code>
          </a>
        </td>
        <td v-html="md.render(transformer.description)"></td>
      </tr>
    </tbody>
  </table>
</template>

<script setup lang="ts">
import Markdown from "markdown-it";
import { data as transformers } from "../transformers.data";

const md = new Markdown();
</script>

<style lang="scss">
table.transformers-table {
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
