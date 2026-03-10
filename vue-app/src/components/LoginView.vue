<template>
  <v-layout justify-center class="layout-down">
    <v-form @submit.prevent="submit" ref="formRef" lazy-validation class="wide-form">
      <v-row>
        <v-col cols="10" lg="12">
          <h2 class="loginHeader">Login</h2>
          <v-text-field
            v-model="email"
            :error-messages="emailErrors"
            label="Email*"
            required
            @input="v$.email.$touch()"
          ></v-text-field>
        </v-col>
      </v-row>

      <v-row>
        <v-col cols="10" lg="12">
          <v-text-field
            v-model="password"
            :error-messages="passwordErrors"
            label="Password*"
            type="password"
            required
            @input="v$.password.$touch()"
          ></v-text-field>
        </v-col>
      </v-row>

      <v-btn color="success" block class="mr-4" type="submit">
        Login
      </v-btn>
      <div class="response">
        <p v-if="submitStatus === 'OK'">You're now logged in!</p>
        <p v-if="submitStatus === 'ERROR'">
          Please fill the form correctly. {{ backendError }}
        </p>
        <p v-if="submitStatus === 'PENDING'">Sending...</p>
      </div>
    </v-form>
    <div class="register-link">
      Don’t have an account?
      <a href="#" @click.prevent="emit('change-view', 'register')">Register</a>
    </div>
  </v-layout>
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

<style>
.response {
  padding-top: 10px;
  color: red;
}
.button-social {
  padding-top: 20px;
}
.loginHeader {
  padding-bottom: 22px;
}

.wide-form {
  width: 40%;
  max-width: 500px;
  margin: 0 auto;
}

.layout-down {
  margin-top: 40px;
}

.divider-or {
  display: flex;
  align-items: center;
  text-align: center;
  margin: 10px 0;
  color: #777;
}

.divider-or::before,
.divider-or::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid #ccc;
}

.divider-or::before {
  margin-right: 10px;
}

.divider-or::after {
  margin-left: 10px;
}

.terms {
  padding-top: 4px;
  font-size: 14px;
}
.button-facebook {
  font-size: 14px;
}
</style>
