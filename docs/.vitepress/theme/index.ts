import DefaultTheme from 'vitepress/theme'
import TwoslashFloatingVue from '@shikijs/vitepress-twoslash/client'

import type { Theme } from 'vitepress'
import HookTable from './components/HookTable.vue'
import ArgsTable from './components/ArgsTable.vue'

import PredicatesTable from './components/PredicatesTable.vue'
import TransformersTable from './components/TransformersTable.vue'
import GuardsTable from './components/GuardsTable.vue'
import HooksTable from './components/HooksTable.vue'
import UtilsTable from './components/UtilsTable.vue'
import Chip from './components/Chip.vue'

import '../style/main.css'
import '@shikijs/vitepress-twoslash/style.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.use(TwoslashFloatingVue)
    app.component('HookTable', HookTable)
    app.component('ArgsTable', ArgsTable)

    app.component('PredicatesTable', PredicatesTable)
    app.component('TransformersTable', TransformersTable)
    app.component('GuardsTable', GuardsTable)
    app.component('HooksTable', HooksTable)
    app.component('UtilsTable', UtilsTable)

    app.component('Chip', Chip)
  },
} satisfies Theme
