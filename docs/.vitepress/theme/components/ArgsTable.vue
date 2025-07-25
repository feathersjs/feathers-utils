<template>
    <table>
        <thead>
            <tr>
                <th>Argument</th>
                <th>Type</th>
                <th>Description</th>
            </tr>
        </thead>
        <tbody>
            <tr v-for="(arg, index) in args" :key="index">
                <td>{{ arg.name }}</td>
                <td>{{ arg.type }}</td>
                <td>{{ arg.description }}</td>
            </tr>
        </tbody>
    </table>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  args: Record<string, any>[];
}>(), {
    args: () => ([])
});
</script>
