<template>
  <v-container class="login-page">
    <v-row justify="center">
      <v-col cols="12" sm="10" md="8" lg="6" xl="5">
        <v-card class="login-card pa-4 pa-sm-8" elevation="3">
          <v-alert v-if="notice" type="info" variant="tonal" class="mb-4">
            {{ notice }}
          </v-alert>

          <h1 class="login-title">Welcome back</h1>
          <p class="login-subtitle">Log in to your toolpath.tech account</p>

          <v-form @submit.prevent="submit" ref="formRef" lazy-validation>
            <v-text-field
              v-model="email"
              :error-messages="emailErrors"
              label="Email"
              type="email"
              autocomplete="email"
              prepend-inner-icon="mdi-email-outline"
              required
              variant="outlined"
              @input="v$.email.$touch()"
              @blur="v$.email.$touch()"
            ></v-text-field>

            <v-text-field
              v-model="password"
              :error-messages="passwordErrors"
              label="Password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              prepend-inner-icon="mdi-lock-outline"
              :append-inner-icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
              required
              variant="outlined"
              @click:append-inner="showPassword = !showPassword"
              @input="v$.password.$touch()"
              @blur="v$.password.$touch()"
            ></v-text-field>

            <v-btn
              type="submit"
              color="success"
              size="large"
              block
              variant="flat"
              :loading="submitStatus === 'PENDING'"
              :disabled="submitStatus === 'PENDING'"
            >
              Login
            </v-btn>

            <v-alert
              v-if="submitStatus === 'OK'"
              type="success"
              variant="tonal"
              density="compact"
              class="mt-4 mb-0"
            >
              You're now logged in!
            </v-alert>
            <v-alert
              v-if="submitStatus === 'ERROR'"
              type="error"
              variant="tonal"
              density="compact"
              class="mt-4 mb-0"
            >
              Please fill the form correctly. {{ backendError }}
            </v-alert>
          </v-form>

          <div class="register-link">
            Don’t have an account?
            <a href="#" @click.prevent="emit('change-view', 'register')">Register</a>
          </div>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { ref, computed } from 'vue'
import { saveAuth, onMessage } from '../vscodeApi'
import { onMounted } from 'vue'
import axios from 'axios'
import { useVuelidate } from '@vuelidate/core'
import { required, maxLength, email as emailValidator } from '@vuelidate/validators'

const formRef = ref(null)
const email = ref('')
const password = ref('')
const submitStatus = ref('')
const backendError = ref('')
const showPassword = ref(false)

defineProps({
  notice: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['change-view'])

const rules = {
  email: { required, email: emailValidator },
  password: { required, maxLength }
}

const v$ = useVuelidate(rules, { email, password })

const emailErrors = computed(() => {
  const errors = []
  if (!v$.value.email.$dirty) return errors
  if (v$.value.email.required.$invalid) errors.push('Email is required.')
  if (v$.value.email.email.$invalid) errors.push('Must be valid e-mail')
  return errors
})

const passwordErrors = computed(() => {
  const errors = []
  if (!v$.value.password.$dirty) return errors
  if (v$.value.password.required.$invalid) errors.push('Password is required')
  return errors
})

const Login = function () {
  const formData = new FormData()
  if (email.value !== '') {
    formData.append('email', email.value)
  }
  if (password.value !== '') {
    formData.append('password', password.value)
  }

  axios({
    method: 'post',
    url: `${import.meta.env.VITE_API_BASE_URL}/api/users/v1/login/`,
    data: formData,
    headers: { 'Content-Type': 'multipart/form-data' }
  })
    .then(response => {
      if (response.status === 200) {
        const token = response.data.token
        const get_user = response.data.user
        saveAuth(token, get_user)
        submitStatus.value = 'OK'
      } else {
        submitStatus.value = 'ERROR'
      }
      setTimeout(() => {
        submitStatus.value = ''
      }, 20000)
    })
    .catch(error => {
      console.log(JSON.stringify(error.response.data))
      submitStatus.value = 'ERROR'
      backendError.value = error.response.data.detail
    })
}

const submit = () => {
  console.log('submit!')
  v$.value.$touch()
  if (v$.value.$invalid) {
    submitStatus.value = 'ERROR'
  } else {
    console.log('send...')
    Login()
    submitStatus.value = 'PENDING'
  }
}

onMounted(() => {
  onMessage((data) => {
    if (data.command === 'authSaved') {
      console.log('Auth saved in VSCode')
    }
  })
})
</script>

<style scoped>
.login-page {
  padding-top: 40px;
  padding-bottom: 40px;
}

.login-card {
  border-radius: 12px;
}

.login-title {
  font-size: 1.75rem;
  font-weight: 600;
  margin-bottom: 8px;
}

.login-subtitle {
  color: rgba(var(--v-theme-on-surface), 0.6);
  margin-bottom: 28px;
}

.register-link {
  margin-top: 24px;
  text-align: center;
  font-size: 0.875rem;
}
</style>
