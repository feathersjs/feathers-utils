<template>
    <div class="space-y-3">
        <div v-for="util in utils" :ref="util.name" class="space-x-2">
            <a :href="util.path">
                <code>{{ util.name }}</code>
            </a>
            <span v-html="md.render(util.description)"></span>
        </div>
    </div>
</template>

<script setup lang="ts">
import { Utility } from "../.vitepress/utilities"
import Markdown from "markdown-it"

const md = new Markdown()

const props = withDefaults(defineProps<{
    utils: Utility[]
}>(), {});
</script>
