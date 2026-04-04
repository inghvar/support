<template>
  <v-app id="inspire">
    <v-navigation-drawer permanent app :width="200" v-if="isLoggedIn">

      <v-list>
        <v-list-item 
          v-for="item in menuItems"
          :key="item.icon"
          :prepend-icon="item.icon"
          :title="item.text"
          @click="changeView(item.value)"
          :active="selectedView === item.value">
        </v-list-item>
      </v-list>
    </v-navigation-drawer>

    <v-app-bar app v-if="isLoggedIn">
    <v-toolbar-title>
      Toolpath Extension
      <a
        href="https://toolpath.tech"
        target="_blank"
        rel="noopener noreferrer"
        style="margin-left: 12px;"
      >
        Go To Website
      </a>
    </v-toolbar-title>
      <v-spacer></v-spacer>

      <span v-if="isLoggedIn && user" class="user-greeting">
        Hi, {{ user.first_name }} {{ user.last_name }}
      </span>

      <v-btn
        v-if="isLoggedIn"
        icon="mdi-logout"
        @click="logout"
      />
    </v-app-bar>

    <v-main>
      <v-container class="py-8 px-6" fluid>
        <v-row>
          <v-col cols="12">
            <div v-if="isLoading" class="text-center">
              <v-progress-circular indeterminate></v-progress-circular>
            </div>
            <component
              v-if="!isLoading"
              :is="currentViewComponent"
              v-bind="currentViewProps"
              @change-view="changeView"
            />
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
import RegisterView from './components/RegisterView.vue'
import LaserForm from './components/LaserPage.vue'
import { getAuth, onMessage, logout } from './vscodeApi'

export default {
  components: {
    ConverterForm,
    LaserForm,
    SettingsView,
    LoginView,
    RegisterView
  },

  data() {
    return {
      drawer: true,
      selectedView: 'register',
      isLoggedIn: false,
      isLoading: true,
      userToken: null,
      user: null,
      menuItems: [
        { icon: 'mdi-saw-blade', text: 'Milling', value: 'milling' },
        { icon: 'mdi-laser-pointer', text: 'Laser', value: 'laser' },
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

  computed: {
    currentViewComponent() {
      if (!this.isLoggedIn) {
        if (this.selectedView === 'login') return 'LoginView'
        return 'RegisterView'
      }

      if (this.selectedView === 'laser') return 'LaserForm'
      if (this.selectedView === 'settings') return 'SettingsView'

      return 'ConverterForm'
    },

    currentViewProps() {
      if (this.isLoggedIn) {
        return { 'auth-token': this.userToken }
      }

      return {}
    }
  },

  methods: {
    changeView(view) {
      this.selectedView = view
    },

    handleAuthMessage(data) {
      if (data.command === 'authData') {
        this.isLoading = false
        if (data.token && data.user) {
          this.isLoggedIn = true
          this.userToken = data.token
          this.user = data.user
        } else {
          this.isLoggedIn = false
          this.userToken = null
          this.user = null
          this.selectedView = 'register'
        }
      }

      if (data.command === 'authSaved') {
        getAuth()
        this.isLoggedIn = true
      }

      if (data.command === 'loggedOut') {
        this.isLoggedIn = false
        this.userToken = null
        this.user = null
        this.selectedView = 'register'
      }
    },
    logout() {
      logout()
    }
  }
}
</script>

<style>

.user-greeting {
  margin-right: 12px;
  padding: 6px 14px;
  background-color: #cfe8d5;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  color: #1b1b1b;
}

</style>
