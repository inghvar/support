<template>
  <v-app id="inspire">
    <v-navigation-drawer permanent app :width="200">

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

    <v-app-bar app>
    <v-toolbar-title>Toolpath Extension</v-toolbar-title>
      <v-spacer></v-spacer>

      <span v-if="isLoggedIn && user" class="user-greeting">
        Hi, {{ user.first_name }} {{ user.last_name }}
      </span>

      <v-btn
        v-if="isLoggedIn"
        icon="mdi-logout"
        @click="logout"
      />

      <template v-else>
        <v-btn variant="text" @click="showAuth('login')">Login</v-btn>
        <v-btn variant="text" @click="showAuth('register')">Register</v-btn>
      </template>
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
import PenPlotterForm from './components/PenPlotterPage.vue'
import { getAuth, onMessage, logout } from './vscodeApi'

const AUTH_VIEWS = ['login', 'register']
const PROTECTED_VIEWS = ['milling']
const AUTH_NOTICE =
  'These functions require registration. Please create a profile or log in to continue.'

export default {
  components: {
    ConverterForm,
    LaserForm,
    PenPlotterForm,
    SettingsView,
    LoginView,
    RegisterView
  },

  data() {
    return {
      drawer: true,
      selectedView: 'penplotter',
      authNotice: '',
      pendingView: null,
      isLoggedIn: false,
      isLoading: true,
      userToken: null,
      user: null,
      menuItems: [
        { icon: 'mdi-saw-blade', text: 'Milling', value: 'milling' },
        { icon: 'mdi-pen', text: 'Pen Plotter', value: 'penplotter' },
        { icon: 'mdi-laser-pointer', text: 'Laser', value: 'laser' },
        { icon: 'mdi-help-circle', text: 'FAQ', value: 'settings' }
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
        if (
          this.selectedView === 'register' ||
          PROTECTED_VIEWS.includes(this.selectedView)
        ) {
          return 'RegisterView'
        }
      }

      if (this.selectedView === 'penplotter') return 'PenPlotterForm'
      if (this.selectedView === 'laser') return 'LaserForm'
      if (this.selectedView === 'settings') return 'SettingsView'

      return 'ConverterForm'
    },

    currentViewProps() {
      if (this.isLoggedIn) {
        return { 'auth-token': this.userToken }
      }

      if (AUTH_VIEWS.includes(this.selectedView)) {
        return { notice: this.authNotice }
      }

      return {}
    }
  },

  methods: {
    changeView(view) {
      if (!this.isLoggedIn && PROTECTED_VIEWS.includes(view)) {
        this.pendingView = view
        this.authNotice = AUTH_NOTICE
        this.selectedView = 'register'
        return
      }

      if (!AUTH_VIEWS.includes(view)) {
        this.authNotice = ''
        this.pendingView = null
      }

      this.selectedView = view
    },

    showAuth(view) {
      this.authNotice = ''
      this.pendingView = null
      this.selectedView = view
    },

    handleAuthMessage(data) {
      if (data.command === 'authData') {
        const isFirstCheck = this.isLoading
        this.isLoading = false

        if (data.token && data.user) {
          this.isLoggedIn = true
          this.userToken = data.token
          this.user = data.user

          if (isFirstCheck) {
            this.selectedView = 'milling'
          } else if (AUTH_VIEWS.includes(this.selectedView)) {
            this.selectedView = this.pendingView || 'milling'
          }
          this.pendingView = null
          this.authNotice = ''
        } else {
          this.isLoggedIn = false
          this.userToken = null
          this.user = null
        }
      }

      if (data.command === 'authSaved') {
        getAuth()
      }

      if (data.command === 'loggedOut') {
        this.isLoggedIn = false
        this.userToken = null
        this.user = null
        this.authNotice = ''
        this.pendingView = null
        this.selectedView = 'penplotter'
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
