<template>
    <div class="space-y-3">
        <div v-for="transformer in transformers" :ref="transformer.name" class="space-x-2">
            <a :href="transformer.path">
                <code>{{ transformer.name }}</code>
            </a>
            <span v-html="md.render(transformer.description)"></span>
        </div>
    </div>
</template>

<script setup lang="ts">
import Markdown from "markdown-it"
import { data as transformers } from "../transformers.data";

const md = new Markdown()
</script>
