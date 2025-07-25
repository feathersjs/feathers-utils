<template>
    <div class="space-y-3">
        <div v-for="predicate in predicates" :ref="predicate.name" class="space-x-2">
            <a :href="predicate.path">
                <code>{{ predicate.name }}</code>
            </a>
            <span v-html="md.render(predicate.description)"></span>
        </div>
    </div>
</template>

<script setup lang="ts">
import Markdown from "markdown-it"
import { data as predicates } from "../predicates.data";

const md = new Markdown()
</script>
