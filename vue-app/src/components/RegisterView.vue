<template>
  <v-layout justify-center class="layout-down">
    <v-form @submit.prevent="submit" ref="formRef" lazy-validation class="wide-form">

      <v-row>
        <h2 class="createProfileHeader">Create Profile</h2>
        <v-col cols="12">
          <v-text-field
            v-model="email"
            :error-messages="emailErrors"
            label="Email*"
            required
            @input="v$.email.$touch()"
          />
        </v-col>
      </v-row>

      <v-row>
        <v-col cols="12">
          <v-text-field
            v-model="password"
            :error-messages="passwordErrors"
            label="Password*"
            type="password"
            required
            @input="v$.password.$touch()"
          />
        </v-col>
      </v-row>

      <v-row>
        <v-col cols="12">
          <v-text-field
            v-model="repeatPassword"
            :error-messages="repeatPasswordErrors"
            label="Repeat Password*"
            type="password"
            required
            @input="v$.repeatPassword.$touch()"
          />
        </v-col>
      </v-row>

      <v-row>
        <v-col cols="12">
          <v-text-field
            v-model="first_name"
            :error-messages="firstNameErrors"
            label="First Name*"
            required
            @input="v$.first_name.$touch()"
          />
        </v-col>
      </v-row>

      <v-row>
        <v-col cols="12">
          <v-text-field
            v-model="last_name"
            :error-messages="lastNameErrors"
            label="Last Name*"
            required
            @input="v$.last_name.$touch()"
          />
        </v-col>
      </v-row>

      <v-row>
        <v-col cols="12">
          <input type="checkbox" v-model="checked" /> I agree with Terms
        </v-col>
      </v-row>

      <v-btn
        color="success"
        block
        type="submit"
        :disabled="submitStatus === 'PENDING'"
      >
        Create
      </v-btn>

      <div class="response">
        <p v-if="submitStatus === 'TERMS'">You must accept Terms</p>
        <p v-if="submitStatus === 'OK'">Account created</p>
        <p v-if="submitStatus === 'ERROR'">
          Please fill the form correctly. {{ backendError }}
        </p>
        <p v-if="submitStatus === 'PENDING'">Sending...</p>
      </div>

    </v-form>
  </v-layout>
</template>

<script setup>
import { ref, computed } from 'vue'
import axios from 'axios'
import { useVuelidate } from '@vuelidate/core'
import { required, minLength, email, sameAs } from '@vuelidate/validators'

const formRef = ref(null)

const emailValue = ref('')
const password = ref('')
const repeatPassword = ref('')
const first_name = ref('')
const last_name = ref('')
const checked = ref(false)

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
    url: `${import.meta.env.VITE_API_BASE_URL}/api/users/v1/registration/`,
    data: formData,
    headers: { 'Content-Type': 'multipart/form-data' }
  })
    .then(response => {
      if (response.status === 201) {
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

<style>
.response {
  padding-top: 10px;
  color: red;
}

.createProfileHeader {
  padding-left: 10px;
  padding-top: 20px;
}

.wide-form {
  width: 40%;
  max-width: 500px;
  margin: 0 auto;
}

.layout-down {
  margin-top: 40px;
}
</style>
