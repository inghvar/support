<template>
  <v-container class="register-page">
    <v-row justify="center">
      <v-col cols="12" sm="10" md="8" lg="6" xl="5">
        <v-card class="register-card pa-4 pa-sm-8" elevation="3">
          <v-alert v-if="notice" type="info" variant="tonal" class="mb-4">
            {{ notice }}
          </v-alert>

          <h1 class="register-title">Create profile</h1>
          <p class="register-subtitle">Sign up to start using toolpath.tech</p>

          <v-form @submit.prevent="submit" ref="formRef" lazy-validation>
            <v-text-field
              v-model="emailValue"
              :error-messages="emailErrors"
              label="Email"
              type="email"
              autocomplete="email"
              prepend-inner-icon="mdi-email-outline"
              required
              variant="outlined"
              @input="v$.email.$touch()"
              @blur="v$.email.$touch()"
            />

            <v-row dense>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="first_name"
                  :error-messages="firstNameErrors"
                  label="First name"
                  autocomplete="given-name"
                  prepend-inner-icon="mdi-account-outline"
                  required
                  variant="outlined"
                  @input="v$.first_name.$touch()"
                  @blur="v$.first_name.$touch()"
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="last_name"
                  :error-messages="lastNameErrors"
                  label="Last name"
                  autocomplete="family-name"
                  prepend-inner-icon="mdi-account-outline"
                  required
                  variant="outlined"
                  @input="v$.last_name.$touch()"
                  @blur="v$.last_name.$touch()"
                />
              </v-col>
            </v-row>

            <v-text-field
              v-model="password"
              :error-messages="passwordErrors"
              label="Password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="new-password"
              prepend-inner-icon="mdi-lock-outline"
              :append-inner-icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
              required
              variant="outlined"
              @click:append-inner="showPassword = !showPassword"
              @input="v$.password.$touch()"
              @blur="v$.password.$touch()"
            />

            <v-text-field
              v-model="repeatPassword"
              :error-messages="repeatPasswordErrors"
              label="Repeat password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="new-password"
              prepend-inner-icon="mdi-lock-check-outline"
              required
              variant="outlined"
              @input="v$.repeatPassword.$touch()"
              @blur="v$.repeatPassword.$touch()"
            />

            <v-checkbox
              v-model="checked"
              :error="submitStatus === 'TERMS'"
              hide-details
            >
              <template #label>
                <span>
                  I agree with
                  <a href="https://toolpath.tech/terms" target="_blank" @click.stop>Terms of Use</a>
                </span>
              </template>
            </v-checkbox>

            <v-btn
              type="submit"
              color="success"
              size="large"
              block
              variant="flat"
              class="mt-6"
              :loading="submitStatus === 'PENDING'"
              :disabled="submitStatus === 'PENDING'"
            >
              Create
            </v-btn>

            <v-alert
              v-if="submitStatus === 'TERMS'"
              type="warning"
              variant="tonal"
              density="compact"
              class="mt-4 mb-0"
            >
              You must accept "Terms of Use"
            </v-alert>
            <v-alert
              v-if="submitStatus === 'OK'"
              type="success"
              variant="tonal"
              density="compact"
              class="mt-4 mb-0"
            >
              Account created
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

          <div class="login-link">
            Already have an account?
            <a href="#" @click.prevent="$emit('change-view', 'login')">
              Log in here
            </a>
          </div>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { ref, computed } from 'vue'
import axios from 'axios'
import { useVuelidate } from '@vuelidate/core'
import { required, minLength, email, sameAs } from '@vuelidate/validators'
import { saveAuth } from '../vscodeApi'

defineProps({
  notice: {
    type: String,
    default: '',
  },
})

const formRef = ref(null)

const emailValue = ref('')
const password = ref('')
const repeatPassword = ref('')
const first_name = ref('')
const last_name = ref('')
const checked = ref(false)
const showPassword = ref(false)

const submitStatus = ref('')
const backendError = ref('')

const rules = {
  email: { required, email },
  password: { required, minLength: minLength(6) },
  repeatPassword: { required, sameAsPassword: sameAs(password) },
  first_name: { required },
  last_name: { required }
}

const v$ = useVuelidate(rules, {
  email: emailValue,
  password,
  repeatPassword,
  first_name,
  last_name
})

const emailErrors = computed(() => {
  const e = []
  if (!v$.value.email.$dirty) return e
  if (v$.value.email.required.$invalid) e.push('Email required')
  if (v$.value.email.email.$invalid) e.push('Invalid email')
  return e
})

const passwordErrors = computed(() => {
  const e = []
  if (!v$.value.password.$dirty) return e
  if (v$.value.password.required.$invalid) e.push('Password required')
  if (v$.value.password.minLength.$invalid) e.push('Min 6 chars')
  return e
})

const repeatPasswordErrors = computed(() => {
  const e = []
  if (!v$.value.repeatPassword.$dirty) return e
  if (v$.value.repeatPassword.sameAsPassword.$invalid)
    e.push('Passwords must match')
  return e
})

const firstNameErrors = computed(() => {
  const e = []
  if (!v$.value.first_name.$dirty) return e
  if (v$.value.first_name.required.$invalid) e.push('Required')
  return e
})

const lastNameErrors = computed(() => {
  const e = []
  if (!v$.value.last_name.$dirty) return e
  if (v$.value.last_name.required.$invalid) e.push('Required')
  return e
})

function Registration() {
  const formData = new FormData()

  formData.append('email', emailValue.value)
  formData.append('password', password.value)
  formData.append('repeatPassword', repeatPassword.value)
  formData.append('first_name', first_name.value)
  formData.append('last_name', last_name.value)

  axios({
    method: 'post',
    url: `${import.meta.env.VITE_API_BASE_URL}/api/users/v1/vsc-registration/`,
    data: formData,
    headers: { 'Content-Type': 'multipart/form-data' }
  })
    .then(response => {
      if (response.status === 201) {
        const token = response.data.token
        const user = response.data.user

        saveAuth(token, user)

        submitStatus.value = 'OK'
      } else {
        submitStatus.value = 'ERROR'
      }
    })
    .catch(error => {
      submitStatus.value = 'ERROR'
      backendError.value = error.response?.data || 'Error'
    })
}

function submit() {
  if (!checked.value) {
    submitStatus.value = 'TERMS'
    return
  }

  v$.value.$touch()

  if (v$.value.$invalid) {
    submitStatus.value = 'ERROR'
  } else {
    submitStatus.value = 'PENDING'
    Registration()
  }
}
</script>

<style scoped>
.register-page {
  padding-top: 40px;
  padding-bottom: 40px;
}

.register-card {
  border-radius: 12px;
}

.register-title {
  font-size: 1.75rem;
  font-weight: 600;
  margin-bottom: 8px;
}

.register-subtitle {
  color: rgba(var(--v-theme-on-surface), 0.6);
  margin-bottom: 28px;
}

.login-link {
  margin-top: 24px;
  text-align: center;
  font-size: 0.875rem;
}
</style>
