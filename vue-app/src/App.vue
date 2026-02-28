<template>
  <v-app id="inspire">
    <v-navigation-drawer permanent app :width="200" v-if="isLoggedIn">
      <v-list>
        <v-list-item v-for="item in menuItems" :key="item.icon" :prepend-icon="item.icon" :title="item.text"
          @click="selectedView = item.value" :active="selectedView === item.value"></v-list-item>
      </v-list>
    </v-navigation-drawer>

    <v-app-bar app v-if="isLoggedIn">
      <v-toolbar-title>Toolpath Extension</v-toolbar-title>
      <v-spacer></v-spacer>
    </v-app-bar>

    <v-main>
      <v-container class="py-8 px-6" fluid>
        <v-row>
          <v-col cols="12">
            <div v-if="isLoading" class="text-center">
              <v-progress-circular indeterminate></v-progress-circular>
            </div>
            <LoginView v-else-if="!isLoggedIn" />
            <ConverterForm v-else-if="selectedView === 'converter'" :auth-token="userToken" />
            <SettingsView v-else-if="selectedView === 'settings'" />
          </v-col>
        </v-row>
      </v-container>
    </v-main>
  </v-app>
</template>

<script>
import ConverterForm from './components/ConverterForm.vue'
import SettingsView from './views/SettingsView.vue'
import LoginView from './components/LoginView.vue'
import { getAuth, onMessage } from './vscodeApi'

export default {
  components: {
    ConverterForm,
    SettingsView,
    LoginView
  },

  data() {
    return {
      drawer: true,
      selectedView: 'converter',
      isLoggedIn: false,
      isLoading: true,
      userToken: null,
      menuItems: [
        { icon: 'mdi-saw-blade', text: 'Converter', value: 'converter' },
        { icon: 'mdi-cog', text: 'Settings', value: 'settings' }
      ]
    }
  },

  mounted() {
    if (typeof acquireVsCodeApi !== 'undefined') {
      onMessage(this.handleAuthMessage)
      getAuth()
    } else {
      // in browser
      this.isLoading = false
      this.isLoggedIn = true
    }
  },

  methods: {
    handleAuthMessage(data) {
      if (data.command === 'authData') {
        this.isLoading = false
        if (data.token && data.user) {
          this.isLoggedIn = true
          this.userToken = data.token
          this.selectedView = 'converter'
        } else {
          this.isLoggedIn = false
        }
      }

      if (data.command === 'authSaved') {
        this.isLoggedIn = true
        this.selectedView = 'converter'
      }
    }
  }
}
</script>
