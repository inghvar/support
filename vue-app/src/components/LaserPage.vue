<template>
  <h2 class="create-title">Create G-code from an Image for Laser Engraving</h2>

  <v-card>
    <v-card-text>
      <p>
        Set the characteristics and upload the image, for empty fields will be used default values
      </p>
      <p>Supports image format .jpeg .png .svg</p>

      <v-form ref="form" @submit.prevent="submit">
        <hr />

        <p class="radioTitle">Please select the type of processing:</p>
        <v-row class="radioSelect">
          <v-radio-group v-model="mode" :error-messages="modeErrors">
            <v-radio label="Vector Engraving" value="LV" />
            <v-radio label="Raster Engraving" value="LR" />
          </v-radio-group>
        </v-row>

        <v-row>
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

        <v-row v-if="isSVG === true && mode === 'LV' && tracingMode !== ''" class="row-converter">
          <v-col cols="16" lg="12">
            <p class="vectorized-image">
              Check out the vectorized image. An Gcode will be generated from this image. Adjust the
              filter if necessary.
            </p>
            <div class="vectorized-image" v-html="fileURL"></div>
          </v-col>
        </v-row>

        <v-row v-if="isSVG === true && mode === 'LV' && tracingMode !== ''" class="row-converter">
          <v-col cols="16" lg="12">
            <v-slider
              v-if="isSVG && mode === 'LV' && tracingMode !== ''"
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

        <v-row v-if="isSVG === true && mode === 'LV' && tracingMode !== ''" class="row-converter">
          <v-col cols="16" lg="12">
            <v-switch
              v-model="background"
              color="black"
              track-color="#66BB6A"
              :label="`Set the background for the image`"
              @update:model-value="onBackgroundChange"
            />
          </v-col>
        </v-row>

        <v-row v-if="isSVG === true && mode === 'LV'" class="radioSelect">
          <v-col>
            <p class="tracingTitle">Tracing type</p>
            <v-radio-group
              v-model="tracingMode"
              :error-messages="tracingModeErrors"
              @update:model-value="onTracingModeChange"
            >
              <v-radio label="Outline" value="OT" />
              <v-radio label="Centerline" value="CT" />
            </v-radio-group>
          </v-col>
        </v-row>

        <v-row v-if="isSVG" class="row-converter">
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
            <p v-if="mode === 'LV'">Set Tolerance (distance between approximation points)</p>
            <p v-if="mode === 'LR'">Set Tolerance (distance between pixels)</p>
            <v-text-field
              v-model="tolerance"
              :error-messages="toleranceErrors"
              label="Tolerance (default 0.2 mm)"
              :rules="toleranceRules"
              outlined
              @input="v$.tolerance.$touch()"
            />
          </v-col>
        </v-row>

        <v-row v-if="mode === 'LV'" class="row-converter">
          <v-col cols="16" lg="6">
            <v-text-field
              v-model="feedSpeed"
              :rules="rapidRules"
              :error-messages="feedErrors"
              label="Rapid Speed (default 300 mm/min)"
              outlined
              @input="v$.feedSpeed.$touch()"
            />
          </v-col>
        </v-row>

        <v-row class="row-converter">
          <v-col cols="16" lg="6">
            <v-text-field
              v-model="cuttingSpeed"
              :error-messages="cuttingErrors"
              :rules="cuttingRules"
              label="Cutting Speed (default 150 mm/min)"
              outlined
              @input="v$.cuttingSpeed.$touch()"
            />
          </v-col>
        </v-row>

        <v-row v-if="mode === 'LR'" class="row-converter">
          <v-col cols="16" lg="6">
            <p>Offset of the start of processing along the X coordinate</p>
            <v-text-field
              v-model="offsetX"
              :error-messages="offsetXErrors"
              :rules="offsetXRules"
              label="Offset X (default 10 mm)"
              outlined
              @input="v$.offsetX.$touch()"
            />
          </v-col>
        </v-row>

        <v-row v-if="mode === 'LR'" class="row-converter">
          <v-col cols="16" lg="6">
            <p>Offset of the start of processing along the Y coordinate</p>
            <v-text-field
              v-model="offsetY"
              :error-messages="offsetYErrors"
              :rules="offsetYRules"
              label="Offset Y (default 10 mm)"
              outlined
              @input="v$.offsetY.$touch()"
            />
          </v-col>
        </v-row>

        <v-row class="row-converter">
          <v-col cols="16" lg="6">
            <p>Laser Power (% of full power = 1000)</p>
            <v-slider
              v-model="laserPower"
              :max="100"
              :step="10"
              show-ticks="always"
              tick-size="4"
              color="primary"
              track-color="success"
              thumb-label
              :tick-labels="['0', '10', '20', '30', '40', '50', '60', '70', '80', '90', '100']"
            >
              <template v-slot:tick-label="{ index }">
                {{ ['0', '10', '20', '30', '40', '50', '60', '70', '80', '90', '100'][index] }}
              </template>
            </v-slider>
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

        <v-row v-if="mode === 'LV'" class="row-converter">
          <v-col cols="16" lg="6">
            <v-text-field
              v-model="passes"
              :error-messages="passesErrors"
              :rules="passesRules"
              label="Passes (default 1)"
              outlined
              @input="v$.passes.$touch()"
            />
          </v-col>
        </v-row>

        <v-row v-if="mode === 'LV'" class="row-converter">
          <v-col cols="16" lg="6">
            <v-text-field
              v-model="passDepth"
              :error-messages="passDepthErrors"
              :rules="passDepthRules"
              label="Pass Depth (default 3 mm)"
              outlined
              @input="v$.passDepth.$touch()"
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

  <div v-if="showCanvas" class="mt-4">
    <v-card>
      <v-card-title class="d-flex align-center">
        G-code Preview
        <v-btn
          v-if="generatedGcodeText"
          class="ml-4"
          color="primary"
          :disabled="processingFrozen"
          @click="onSaveClick"
        >
          Save G-code
        </v-btn>
      </v-card-title>
      <v-card-text>
        <ThreeCanvasHelp :gcode-source="generatedGcodeText" />
      </v-card-text>
    </v-card>
  </div>

  <v-row v-if="mode === 'LR' && heightMapPreviewUrl" class="file-preview">
    <div class="preview">Preview:</div>
    <v-img :src="heightMapPreviewUrl" style="border: 1px dashed #ccc; min-height: 250px" />
  </v-row>

  <v-dialog v-model="showConfirmDialogThree" max-width="500">
    <v-card>
      <v-card-title class="headline">Show toolpath</v-card-title>
      <v-card-text> Continue? </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn text color="primary" @click="onCancel">Cancel</v-btn>
        <v-btn text color="primary" @click="onConfirm">Continue</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { computed, ref } from 'vue'
import axios from 'axios'
import { useVuelidate } from '@vuelidate/core'
import { decimal, numeric, required, requiredIf } from '@vuelidate/validators'
import ThreeCanvasHelp from './ThreeCanvasHelp.vue'
import { sendMessage } from '../vscodeApi'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

const props = defineProps({
  authToken: {
    type: String,
    required: true,
  },
})

const image = ref(undefined)
const imageUrl = ref('')
const feedSpeed = ref('')
const cuttingSpeed = ref('')
const passDepth = ref('')
const passes = ref('')
const header = ref('G17\nG90\nG0 X0 Y0')
const end = ref('M5')
const file = ref(null)
const submitStatus = ref('')
const backendError = ref('')
const snackbar = ref(false)
const text = ref('')
const loadingProgressBar = ref(false)
const isSVG = ref(false)
const maxSize = ref('')
const tolerance = ref('')
const filterCoefficient = ref(0)
const fileURL = ref('')
const background = ref(false)
const bgUserOverride = ref(false)
const mode = ref('')
const tracingMode = ref('')
const laserPower = ref(80)
const offsetX = ref('')
const offsetY = ref('')
const generatedGcodeText = ref('')
const showCanvas = ref(false)
const processingFrozen = ref(false)
const showConfirmDialogThree = ref(false)
const heightMapPreviewUrl = ref('')
const filter = ref(0)

let fileContent = ''
let fileName = ''

const ticksLabels = [
  'No Filter',
  'Weak Filter',
  'Middle Filter',
  'Strong Filter',
  'Extra Strong Filter',
]

const fileInputRules = [
  (value) => !value || value.size <= 1024 * 1000 * 15 || 'Image size should be less than 15 MB!',
  (value) => !value || value.size >= 1024 * 1 || 'Image size should be greater than 2 KB!',
  (value) =>
    !value ||
    value.type === 'image/svg+xml' ||
    value.type === 'image/jpeg' ||
    value.type === 'image/png' ||
    'This type of file not accepted!',
]

const cuttingRules = [
  (value) => !value || value < 6000 || 'Value should be less than 6000',
  (value) => !value || value > 10 || 'Value should be greater than 10',
]

const rapidRules = [
  (value) => !value || value < 10000 || 'Value should be less than 10000',
  (value) => !value || value > 100 || 'Value should be greater than 100',
]

const passDepthRules = [
  (value) => !value || value < 8 || 'Value should be less than 8',
  (value) => !value || value > 1 || 'Value should be greater than 1',
]

const passesRules = [
  (value) => !value || value < 10 || 'Value should be less than 10',
  (value) => !value || value > 1 || 'Value should be greater than 1',
]

const toleranceRules = [
  (value) => {
    if (value === '' || value === null || value === undefined) {
      return true
    }

    if (mode.value === 'LR') {
      return (value >= 0.1 && value <= 0.5) || 'Value should be between 0.1 and 0.6 for raster mode'
    }

    return (value >= 0.01 && value <= 5) || 'Value should be between 0.01 and 5'
  },
]

const offsetXRules = [
  (value) => !value || value < 1000 || 'Value should be less than 1000',
  (value) => !value || value >= 0 || 'Value should be 0 or greater than 0',
]

const offsetYRules = [
  (value) => !value || value < 1000 || 'Value should be less than 1000',
  (value) => !value || value >= 0 || 'Value should be 0 or greater than 0',
]

const rules = {
  file: { required },
  feedSpeed: { numeric },
  cuttingSpeed: { numeric },
  passDepth: { numeric },
  passes: { numeric },
  maxSize: { numeric },
  tolerance: { decimal },
  mode: { required },
  tracingMode: {
    required: requiredIf(() => mode.value === 'LV' && isSVG.value === true),
  },
  header: { required },
  end: { required },
  offsetX: { decimal },
  offsetY: { decimal },
}

const v$ = useVuelidate(rules, {
  file,
  feedSpeed,
  cuttingSpeed,
  passDepth,
  passes,
  maxSize,
  tolerance,
  mode,
  tracingMode,
  header,
  end,
  offsetX,
  offsetY,
})

const fileErrors = computed(() => {
  const errors = []
  if (!v$.value.file.$dirty) return errors
  if (!v$.value.file.required) errors.push('file is required.')
  return errors
})

const feedErrors = computed(() => {
  const errors = []
  if (!v$.value.feedSpeed.$dirty) return errors
  if (!v$.value.feedSpeed.numeric) errors.push('Only numbers are allowed.')
  return errors
})

const cuttingErrors = computed(() => {
  const errors = []
  if (!v$.value.cuttingSpeed.$dirty) return errors
  if (!v$.value.cuttingSpeed.numeric) errors.push('Only numbers are allowed.')
  return errors
})

const passDepthErrors = computed(() => {
  const errors = []
  if (!v$.value.passDepth.$dirty) return errors
  if (!v$.value.passDepth.numeric) errors.push('Only numbers are allowed.')
  return errors
})

const passesErrors = computed(() => {
  const errors = []
  if (!v$.value.passes.$dirty) return errors
  if (!v$.value.passes.numeric) errors.push('Only numbers are allowed.')
  return errors
})

const maxSizeErrors = computed(() => {
  const errors = []
  if (!v$.value.maxSize.$dirty) return errors
  if (!v$.value.maxSize.numeric) errors.push('Only numbers are allowed.')
  return errors
})

const toleranceErrors = computed(() => {
  const errors = []
  if (!v$.value.tolerance.$dirty) return errors
  if (!v$.value.tolerance.decimal) errors.push('Only numbers are allowed.')
  return errors
})

const modeErrors = computed(() => {
  const errors = []
  if (!v$.value.mode.$dirty) return errors
  if (!v$.value.mode.required) errors.push('choice in required.')
  return errors
})

const headerErrors = computed(() => {
  const errors = []
  if (!v$.value.header.$dirty) return errors
  if (!v$.value.header.required) errors.push('this field is required.')
  return errors
})

const tracingModeErrors = computed(() => {
  if (isSVG.value === false) return []
  const errors = []
  if (!v$.value.tracingMode.$dirty) return errors
  if (!v$.value.tracingMode.required) errors.push('choice in required.')
  return errors
})

const endErrors = computed(() => {
  const errors = []
  if (!v$.value.end.$dirty) return errors
  if (!v$.value.end.required) errors.push('this field is required.')
  return errors
})

const offsetXErrors = computed(() => {
  const errors = []
  if (!v$.value.offsetX.$dirty) return errors
  return errors
})

const offsetYErrors = computed(() => {
  const errors = []
  if (!v$.value.offsetY.$dirty) return errors
  return errors
})

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

  if (file.value.type !== 'image/svg+xml') {
    isSVG.value = true
    getVectorized()
  } else {
    isSVG.value = false
  }

  createImage(fileValue)
  backendError.value = ''
}

const getFitler = () => {
  if (filterCoefficient.value === 0) {
    filter.value = 0
  } else if (filterCoefficient.value === 1) {
    filter.value = 2
  } else if (filterCoefficient.value === 2) {
    filter.value = 4
  } else if (filterCoefficient.value === 3) {
    filter.value = 6
  } else if (filterCoefficient.value === 4) {
    filter.value = 10
  }
}

const onConfirm = () => {
  showConfirmDialogThree.value = false
  showCanvas.value = true
}

const onCancel = () => {
  showConfirmDialogThree.value = false
}

const onSaveClick = () => {
  sendMessage('saveGcodeFile', {
    gcode: fileContent,
    fileName,
  })
}

const Converter = () => {
  getFitler()

  const formData = new FormData()

  if (feedSpeed.value !== '') {
    formData.append('movement_speed', feedSpeed.value)
  }
  if (cuttingSpeed.value !== '') {
    formData.append('cutting_speed', cuttingSpeed.value)
  }
  if (passDepth.value !== '') {
    formData.append('pass_depth', passDepth.value)
  }
  if (passes.value !== '') {
    formData.append('passes', passes.value)
  }
  if (file.value) {
    formData.append('file', file.value)
  }
  if (maxSize.value !== '') {
    formData.append('max_size', maxSize.value)
  }
  if (filterCoefficient.value !== 0) {
    formData.append('filter_coefficient', filter.value)
  }
  formData.append('background', background.value)
  if (tolerance.value !== '') {
    formData.append('tolerance', tolerance.value)
  }
  if (mode.value !== '') {
    formData.append('mode', mode.value)
  }
  if (tracingMode.value !== '') {
    formData.append('tracing_mode', tracingMode.value)
  }
  if (header.value !== '') {
    formData.append('header', header.value)
  }
  if (end.value !== '') {
    formData.append('end', end.value)
  }
  formData.append('laser_power', laserPower.value)
  formData.append('offset_x', offsetX.value)
  formData.append('offset_y', offsetY.value)

  let url = `${API_BASE_URL}/api/converter/v2/laserv`
  if (mode.value === 'LR') {
    url = `${API_BASE_URL}/api/converter/v2/laserr`
  }

  axios({
    method: 'post',
    url,
    data: formData,
    headers: {
      Authorization: `Token ${props.authToken}`,
      'Content-Type': 'multipart/form-data',
    },
  })
    .then((response) => {
      if (response.status === 200) {
        let contentDisposition = response.headers['content-disposition'] || ''
        let parsedFileName = 'laser_output.nc'

        if (/=\?utf-8\?b\?/i.test(contentDisposition)) {
          const b64 = contentDisposition.match(/=\?utf-8\?b\?(.*?)\?=/i)[1]
          const decoded = atob(b64)
          contentDisposition = new TextDecoder('utf-8').decode(
            Uint8Array.from(decoded, (c) => c.charCodeAt(0)),
          )
        }

        if (contentDisposition.includes(';') && contentDisposition.includes('=')) {
          parsedFileName = contentDisposition.split(';')[1].split('=')[1].replaceAll('"', '')
          if (!parsedFileName.endsWith('.nc')) {
            parsedFileName += '.nc'
          }
        }

        fileName = parsedFileName
        fileContent = response.data

        submitStatus.value = 'OK'
        loadingProgressBar.value = false
        processingFrozen.value = false

        if (mode.value === 'LR') {
          generatedGcodeText.value = response.data
        } else {
          generatedGcodeText.value = response.data
          const lines = generatedGcodeText.value.split('\n')
          const isLongGcode = lines.length > 50000
          if (isLongGcode) {
            showConfirmDialogThree.value = true
          } else {
            showCanvas.value = true
          }
        }
      } else {
        submitStatus.value = 'ERROR'
        loadingProgressBar.value = false
        processingFrozen.value = false
      }
    })
    .catch((error) => {
      submitStatus.value = 'ERROR'
      loadingProgressBar.value = false
      processingFrozen.value = false
      backendError.value = error.response?.data || 'Request failed'

      if (
        error.response?.data?.detail === 'Invalid token.' ||
        backendError.value === 'Invalid token.'
      ) {
        text.value = 'Only registered users can create G-code'
        backendError.value = 'Only registered users can create G-code'
        snackbar.value = true
      } else {
        text.value = backendError.value
        snackbar.value = true
      }
    })
}

const getVectorized = () => {
  if (tracingMode.value === '') return

  getFitler()

  const formData = new FormData()

  if (file.value) {
    formData.append('file', file.value)
  }
  if (filterCoefficient.value !== 0) {
    formData.append('filter_coefficient', filter.value)
  }
  if (maxSize.value !== '') {
    formData.append('max_size', maxSize.value)
  }
  formData.append('background', background.value)
  if (tracingMode.value !== '') {
    formData.append('tracing_mode', tracingMode.value)
  }

  axios({
    method: 'post',
    url: `${API_BASE_URL}/api/converter/v1/get-vectorized`,
    data: formData,
    headers: {
      Authorization: `Token ${props.authToken}`,
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
      backendError.value = error.response?.data || 'Request failed'

      if (
        error.response?.data?.detail === 'Invalid token.' ||
        backendError.value === 'Invalid token.'
      ) {
        text.value = 'only registered user can be create G-code'
        backendError.value = 'Only registered user can be create G-code'
        snackbar.value = true
      } else {
        text.value = backendError.value
        snackbar.value = true
      }
    })
}

const submit = async () => {
  showCanvas.value = false
  v$.value.$touch()

  if (v$.value.$invalid) {
    submitStatus.value = 'ERROR'
    return
  }

  submitStatus.value = 'PENDING'
  loadingProgressBar.value = true
  processingFrozen.value = true
  heightMapPreviewUrl.value = ''

  Converter()
}
</script>

<style scoped>
.create-title {
  margin-bottom: 16px;
}

.radioTitle {
  margin-top: 28px;
  margin-bottom: 14px;
  font-weight: bold;
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

.response {
  margin-top: 12px;
}

.converter-button {
  margin-top: 8px;
}

.preview {
  margin-bottom: 8px;
  font-weight: 600;
}
</style>
