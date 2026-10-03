<template>
  <h2 class="create-title">Create G-code from an Image for Pen Plotter</h2>

  <v-card>
    <v-card-text>
      <p>
        Set the characteristics and upload the image, for empty fields will be used default values
      </p>
      <p>Supports image format .jpeg .png .svg</p>

      <v-form ref="form" @submit.prevent="submit">
        <hr />

        <v-row class="mt-4">
          <v-file-input
            v-model="file"
            show-size
            counter
            required
            accept="image/png, image/jpeg, image/svg+xml"
            :rules="fileInputRules"
            :error-messages="fileErrors"
            label="Upload a image here"
            @update:model-value="onFileChange"
          />
        </v-row>

        <v-row class="file-preview">
          <v-img :src="imageUrl" style="border: 1px dashed #ccc; min-height: 250px" />
        </v-row>

        <v-row v-if="isRaster" class="row-converter">
          <v-col cols="16" lg="12">
            <p class="vectorized-image">
              Check out the vectorized image. An Gcode will be generated from this image. Adjust the
              filter if necessary.
            </p>
            <div class="vectorized-image vectorized-preview" v-html="fileURL"></div>
          </v-col>
        </v-row>

        <v-row v-if="isRaster" class="row-converter">
          <v-col cols="16" lg="12">
            <v-slider
              v-model="filterCoefficient"
              :tick-labels="ticksLabels"
              :max="4"
              :step="1"
              show-ticks="always"
              tick-size="4"
              color="primary"
              track-color="success"
              thumb-label
              @update:model-value="getVectorized"
            >
              <template v-slot:tick-label="{ index }">
                {{ ticksLabels[index] }}
              </template>
            </v-slider>
          </v-col>
        </v-row>

        <v-row v-if="isRaster" class="row-converter">
          <v-col cols="16" lg="12">
            <v-switch
              v-model="background"
              color="primary"
              label="Set the background for the image"
              @update:model-value="onBackgroundChange"
            />
          </v-col>
        </v-row>

        <v-row v-if="isRaster" class="radioSelect">
          <v-col>
            <p class="tracingTitle">Tracing Mode</p>
            <v-radio-group
              v-model="tracingMode"
              :error-messages="tracingModeErrors"
              @update:model-value="onTracingModeChange"
            >
              <v-radio label="Outline tracing" value="OT" />
              <v-radio label="Centerline tracing" value="CT" />
            </v-radio-group>
          </v-col>
        </v-row>

        <v-row class="row-converter">
          <v-col cols="16" lg="6">
            <p>Height of the processing area</p>
            <v-text-field
              v-model="height"
              :error-messages="heightErrors"
              :rules="heightRules"
              label="Height (mm)"
              outlined
              @input="v$.height.$touch()"
            />
          </v-col>
        </v-row>

        <v-row class="row-converter">
          <v-col cols="16" lg="6">
            <p>Width of the processing area</p>
            <v-text-field
              v-model="width"
              :error-messages="widthErrors"
              :rules="widthRules"
              label="Width (mm)"
              outlined
              @input="v$.width.$touch()"
            />
          </v-col>
        </v-row>

        <v-row class="row-converter">
          <v-col cols="16" lg="6">
            <p>Set Tolerance (distance between approximation points)</p>
            <v-text-field
              v-model="tolerance"
              :error-messages="toleranceErrors"
              :rules="toleranceRules"
              label="Tolerance (default 0.2 mm)"
              outlined
              @input="v$.tolerance.$touch()"
            />
          </v-col>
        </v-row>

        <v-row v-if="isRaster" class="row-converter">
          <v-col cols="16" lg="6">
            <p>
              Set, Max Size, if you want to reduce the image (the largest side will be reduced, the
              smallest side proportionally)
            </p>
            <v-text-field
              v-model="maxSize"
              :error-messages="maxSizeErrors"
              label="Max Size (in pixel)"
              outlined
              @input="v$.maxSize.$touch()"
            />
          </v-col>
        </v-row>

        <v-row class="row-converter">
          <v-col cols="16" lg="6">
            <v-text-field
              v-model="feedSpeed"
              :rules="rapidRules"
              :error-messages="feedErrors"
              label="Movement Speed, pen up (default 3000 mm/min)"
              outlined
              @input="v$.feedSpeed.$touch()"
            />
          </v-col>
        </v-row>

        <v-row class="row-converter">
          <v-col cols="16" lg="6">
            <v-text-field
              v-model="drawingSpeed"
              :rules="drawingRules"
              :error-messages="drawingErrors"
              label="Drawing Speed, pen down (default 1500 mm/min)"
              outlined
              @input="v$.drawingSpeed.$touch()"
            />
          </v-col>
        </v-row>

        <v-row class="row-converter">
          <v-col cols="16" lg="6">
            <v-text-field
              v-model="penUpZ"
              :rules="penUpZRules"
              :error-messages="penUpZErrors"
              label="Pen Up Z - height of raised pen (default 5 mm)"
              outlined
              @input="v$.penUpZ.$touch()"
            />
          </v-col>
        </v-row>

        <v-row class="row-converter">
          <v-col cols="16" lg="6">
            <v-text-field
              v-model="penDownZ"
              :rules="penDownZRules"
              :error-messages="penDownZErrors"
              label="Pen Down Z - working height of pen (default 0 mm)"
              outlined
              @input="v$.penDownZ.$touch()"
            />
          </v-col>
        </v-row>

        <v-row class="row-converter">
          <v-col cols="16" lg="6">
            <v-textarea
              v-model="header"
              :error-messages="headerErrors"
              label="Set here header"
              outlined
              @input="v$.header.$touch()"
            />
          </v-col>
        </v-row>

        <v-row class="row-converter">
          <v-col cols="16" lg="6">
            <v-textarea
              v-model="end"
              :error-messages="endErrors"
              label="Set end of program here"
              outlined
              @input="v$.end.$touch()"
            />
          </v-col>
        </v-row>

        <v-btn
          class="mr-4 converter-button"
          color="success"
          :disabled="processingFrozen"
          type="submit"
        >
          Processing
        </v-btn>

        <div class="response">
          <p v-if="submitStatus === 'OK'">G-code generation completed successfully</p>
          <p v-if="submitStatus === 'ERROR'">
            {{ backendError }}
          </p>
          <p v-if="submitStatus === 'PENDING'">Processing ...</p>
        </div>
      </v-form>

      <v-progress-linear
        :active="loadingProgressBar"
        :indeterminate="loadingProgressBar"
        color="#5AB55E"
      />
    </v-card-text>
  </v-card>

  <v-snackbar v-model="snackbar" top right color="#5AB55E" timeout="3000">
    {{ text }}
  </v-snackbar>

  <div v-if="generatedGcodeText" class="mt-4">
    <v-card>
      <v-card-title class="d-flex align-center">
        G-code Preview
        <v-btn class="ml-4" color="primary" @click="onSaveClick">Save G-code</v-btn>
      </v-card-title>
      <v-card-text>
        <ThreeCanvasHelp v-if="showCanvas" :gcode-source="generatedGcodeText" />
        <div v-else>
          <p>The G-code is long, rendering the toolpath may take some time.</p>
          <v-btn color="primary" @click="showCanvas = true">Show toolpath</v-btn>
        </div>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import axios from 'axios'
import { useVuelidate } from '@vuelidate/core'
import { decimal, numeric, required, requiredIf } from '@vuelidate/validators'
import ThreeCanvasHelp from './ThreeCanvasHelp.vue'
import { sendMessage } from '../vscodeApi'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
const LONG_GCODE_LINES = 50000

const props = defineProps({
  authToken: {
    type: String,
    default: '',
  },
})

const imageUrl = ref('')
const feedSpeed = ref('')
const drawingSpeed = ref('')
const penUpZ = ref('')
const penDownZ = ref('')
const header = ref('G17\nG90\nG0 X0 Y0')
const end = ref('M2')
const file = ref(null)
const submitStatus = ref('')
const backendError = ref('')
const snackbar = ref(false)
const text = ref('')
const loadingProgressBar = ref(false)
const isRaster = ref(false)
const maxSize = ref('')
const height = ref('')
const width = ref('')
const tolerance = ref('')
const filterCoefficient = ref(0)
const fileURL = ref('')
const background = ref(true)
const bgUserOverride = ref(false)
const tracingMode = ref('CT')
const generatedGcodeText = ref('')
const showCanvas = ref(false)
const processingFrozen = ref(false)

let fileName = ''

const ticksLabels = [
  'No Filter',
  'Weak Filter',
  'Middle Filter',
  'Strong Filter',
  'Extra Strong Filter',
]

const FILTER_VALUES = [0, 2, 4, 6, 10]

const fileInputRules = [
  (value) => !value || value.size <= 1024 * 1000 * 25 || 'Image size should be less than 25 MB!',
  (value) => !value || value.size >= 1024 * 1 || 'Image size should be greater than 1 KB!',
  (value) =>
    !value ||
    value.type === 'image/svg+xml' ||
    value.type === 'image/jpeg' ||
    value.type === 'image/png' ||
    'This type of file not accepted!',
]

const drawingRules = [
  (value) => !value || value < 6000 || 'Value should be less than 6000',
  (value) => !value || value > 10 || 'Value should be greater than 10',
]

const rapidRules = [
  (value) => !value || value < 10000 || 'Value should be less than 10000',
  (value) => !value || value > 100 || 'Value should be greater than 100',
]

const toleranceRules = [
  (value) => !value || value <= 5 || 'Value should be less than 5',
  (value) => !value || value >= 0.01 || 'Value should be greater or equal 0.01',
]

const penUpZRules = [
  (value) => !value || (value >= 0.1 && value <= 50) || 'Value should be between 0.1 and 50',
]

const penDownZRules = [
  (value) =>
    value === '' || value === null || (value >= -5 && value <= 5) || 'Value should be between -5 and 5',
]

const heightRules = [(value) => !value || value > 9 || 'Value should be greater than 9']

const widthRules = [(value) => !value || value > 9 || 'Value should be greater than 9']

const rules = {
  file: { required },
  feedSpeed: { numeric },
  drawingSpeed: { numeric },
  penUpZ: { decimal },
  penDownZ: { decimal },
  maxSize: { numeric },
  height: {
    numeric,
    heightWithWidth: (value) => (!!value && !!width.value) || (!value && !width.value),
  },
  width: {
    numeric,
    widthWithHeight: (value) => (!!value && !!height.value) || (!value && !height.value),
  },
  tolerance: { decimal },
  tracingMode: {
    required: requiredIf(() => isRaster.value === true),
  },
  header: { required },
  end: { required },
}

const v$ = useVuelidate(rules, {
  file,
  feedSpeed,
  drawingSpeed,
  penUpZ,
  penDownZ,
  maxSize,
  height,
  width,
  tolerance,
  tracingMode,
  header,
  end,
})

const fileErrors = computed(() => {
  const errors = []
  if (!v$.value.file.$dirty) return errors
  if (v$.value.file.required.$invalid) errors.push('file is required.')
  return errors
})

const numberError = (field) => {
  const errors = []
  if (!v$.value[field].$dirty) return errors
  if (v$.value[field].$invalid) errors.push('Only numbers are allowed.')
  return errors
}

const feedErrors = computed(() => numberError('feedSpeed'))
const drawingErrors = computed(() => numberError('drawingSpeed'))
const penUpZErrors = computed(() => numberError('penUpZ'))
const penDownZErrors = computed(() => numberError('penDownZ'))
const maxSizeErrors = computed(() => numberError('maxSize'))
const toleranceErrors = computed(() => numberError('tolerance'))

const heightErrors = computed(() => {
  const errors = []
  if (!v$.value.height.$dirty) return errors
  if (v$.value.height.numeric.$invalid) errors.push('Only numbers are allowed.')
  if (v$.value.height.heightWithWidth.$invalid) errors.push('Fill both height and width.')
  return errors
})

const widthErrors = computed(() => {
  const errors = []
  if (!v$.value.width.$dirty) return errors
  if (v$.value.width.numeric.$invalid) errors.push('Only numbers are allowed.')
  if (v$.value.width.widthWithHeight.$invalid) errors.push('Fill both height and width.')
  return errors
})

const tracingModeErrors = computed(() => {
  const errors = []
  if (!isRaster.value || !v$.value.tracingMode.$dirty) return errors
  if (v$.value.tracingMode.required.$invalid) errors.push('choice in required.')
  return errors
})

const headerErrors = computed(() => {
  const errors = []
  if (!v$.value.header.$dirty) return errors
  if (v$.value.header.required.$invalid) errors.push('this field is required.')
  return errors
})

const endErrors = computed(() => {
  const errors = []
  if (!v$.value.end.$dirty) return errors
  if (v$.value.end.required.$invalid) errors.push('this field is required.')
  return errors
})

const authHeaders = () => (props.authToken ? { Authorization: `Token ${props.authToken}` } : {})

const formatError = (error) => {
  const data = error.response?.data
  if (!data) return error.message || 'Request failed'
  if (typeof data === 'string') return data
  if (data.detail) return data.detail
  return Object.entries(data)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(' ') : value}`)
    .join('; ')
}

const createImage = (fileValue) => {
  const reader = new FileReader()

  reader.onload = (e) => {
    imageUrl.value = e.target.result
  }

  reader.readAsDataURL(fileValue)
}

const onTracingModeChange = (val) => {
  v$.value.tracingMode.$touch()

  if (!bgUserOverride.value) {
    background.value = val === 'CT'
  }

  getVectorized()
}

const onBackgroundChange = () => {
  bgUserOverride.value = true
  getVectorized()
}

const onFileChange = (fileValue) => {
  if (!fileValue) {
    return
  }

  file.value = fileValue
  v$.value.file.$touch()

  if (fileValue.type !== 'image/svg+xml') {
    isRaster.value = true
    getVectorized()
  } else {
    isRaster.value = false
  }

  createImage(fileValue)
  backendError.value = ''
}

const onSaveClick = () => {
  sendMessage('saveGcodeFile', {
    gcode: generatedGcodeText.value,
    fileName,
  })
}

const parseFileName = (contentDisposition) => {
  let value = contentDisposition || ''

  if (/=\?utf-8\?b\?/i.test(value)) {
    const b64 = value.match(/=\?utf-8\?b\?(.*?)\?=/i)[1]
    const decoded = atob(b64)
    value = new TextDecoder('utf-8').decode(Uint8Array.from(decoded, (c) => c.charCodeAt(0)))
  }

  if (value.includes(';') && value.includes('=')) {
    return value.split(';')[1].split('=')[1].replaceAll('"', '') + '.nc'
  }

  return 'pen_plotter.nc'
}

const Converter = () => {
  const formData = new FormData()

  if (feedSpeed.value !== '') formData.append('movement_speed', feedSpeed.value)
  if (drawingSpeed.value !== '') formData.append('drawing_speed', drawingSpeed.value)
  if (penUpZ.value !== '') formData.append('pen_up_z', penUpZ.value)
  if (penDownZ.value !== '') formData.append('pen_down_z', penDownZ.value)
  if (file.value) formData.append('file', file.value)
  if (maxSize.value !== '') formData.append('max_size', maxSize.value)
  if (height.value !== '') formData.append('height', height.value)
  if (width.value !== '') formData.append('width', width.value)
  if (filterCoefficient.value !== 0) {
    formData.append('filter_coefficient', FILTER_VALUES[filterCoefficient.value])
  }
  formData.append('background', background.value)
  if (tolerance.value !== '') formData.append('tolerance', tolerance.value)
  if (tracingMode.value !== '') formData.append('tracing_mode', tracingMode.value)
  if (header.value !== '') formData.append('header', header.value)
  if (end.value !== '') formData.append('end', end.value)

  axios({
    method: 'post',
    url: `${API_BASE_URL}/api/converter/v1/pen-plotter`,
    data: formData,
    headers: {
      ...authHeaders(),
      'Content-Type': 'multipart/form-data',
    },
  })
    .then((response) => {
      if (response.status === 200) {
        fileName = parseFileName(response.headers['content-disposition'])
        generatedGcodeText.value = response.data
        showCanvas.value = response.data.split('\n').length <= LONG_GCODE_LINES
        submitStatus.value = 'OK'
      } else {
        submitStatus.value = 'ERROR'
      }
    })
    .catch((error) => {
      submitStatus.value = 'ERROR'
      backendError.value = formatError(error)
      text.value = backendError.value
      snackbar.value = true
    })
    .finally(() => {
      loadingProgressBar.value = false
      processingFrozen.value = false
    })
}

const getVectorized = () => {
  if (tracingMode.value === '' || !file.value) return

  const formData = new FormData()

  formData.append('file', file.value)
  if (filterCoefficient.value !== 0) {
    formData.append('filter_coefficient', FILTER_VALUES[filterCoefficient.value])
  }
  if (maxSize.value !== '') formData.append('max_size', maxSize.value)
  if (height.value !== '') formData.append('height', height.value)
  if (width.value !== '') formData.append('width', width.value)
  formData.append('background', background.value)
  formData.append('tracing_mode', tracingMode.value)
  formData.append('mode', 'PP')

  axios({
    method: 'post',
    url: `${API_BASE_URL}/api/converter/v1/get-vectorized`,
    data: formData,
    headers: {
      ...authHeaders(),
      'Content-Type': 'multipart/form-data',
    },
  })
    .then((response) => {
      if (response.status === 200) {
        fileURL.value = response.data
        submitStatus.value = ''
      } else {
        submitStatus.value = 'ERROR'
      }
    })
    .catch((error) => {
      submitStatus.value = 'ERROR'
      backendError.value = formatError(error)
      text.value = backendError.value
      snackbar.value = true
    })
}

const submit = () => {
  showCanvas.value = false
  generatedGcodeText.value = ''
  v$.value.$touch()

  if (v$.value.$invalid) {
    submitStatus.value = 'ERROR'
    return
  }

  submitStatus.value = 'PENDING'
  loadingProgressBar.value = true
  processingFrozen.value = true

  Converter()
}
</script>

<style scoped>
.create-title {
  margin-bottom: 16px;
}

.tracingTitle {
  margin-bottom: 8px;
  font-weight: bold;
}

.row-converter {
  margin-top: 8px;
}

.file-preview {
  margin-top: 12px;
  margin-bottom: 12px;
}

.vectorized-image {
  width: 100%;
  overflow: auto;
}

.vectorized-preview {
  background: #fff;
  padding: 8px;
}

.response {
  margin-top: 12px;
}

.converter-button {
  margin-top: 8px;
}
</style>
