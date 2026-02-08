<template>
  <v-app id="inspire">
    <v-navigation-drawer
      v-model="drawer"
      app
      :width="200"
    >
      <v-list>
        <v-list-item
          v-for="item in menuItems"
          :key="item.icon"
          :prepend-icon="item.icon"
          :title="item.text"
          @click="selectedView = item.value"
          :active="selectedView === item.value"
        ></v-list-item>
      </v-list>
    </v-navigation-drawer>

    <v-app-bar app>
      <v-app-bar-nav-icon @click="drawer = !drawer"></v-app-bar-nav-icon>
      <v-toolbar-title>Toolpath Extension</v-toolbar-title>
      <v-spacer></v-spacer>
    </v-app-bar>

    <v-main>
      <v-container
        class="py-8 px-6"
        fluid
      >
        <v-row>
          <v-col cols="12">
            <ConverterForm v-if="selectedView === 'converter'" />
            <SettingsView v-if="selectedView === 'settings'" />
          </v-col>
        </v-row>
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup>
import { ref } from 'vue'
import ConverterForm from './components/ConverterForm.vue'
import SettingsView from './views/SettingsView.vue'

const drawer = ref(true)
const selectedView = ref('converter')

const menuItems = [
  { icon: 'mdi-saw-blade', text: 'Converter', value: 'converter' },
  { icon: 'mdi-cog', text: 'Settings', value: 'settings' }
]
</script>
