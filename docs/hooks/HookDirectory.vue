<template>
    <div class="space-y-3">
        <div v-for="hook in hooks" :ref="hook.name" class="space-x-2">
            <a :href="hook.path">
                <code>{{ hook.name }}</code>
            </a>
            <span v-html="md.render(hook.description)"></span>
        </div>
    </div>
</template>

<script setup lang="ts">
import { Utility } from "../.vitepress/utilities"
import Markdown from "markdown-it"

const md = new Markdown()

const props = withDefaults(defineProps<{
    hooks: Utility[]
}>(), {});
</script>
