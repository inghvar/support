<template>
    <h2 class="create-title">Image to G-code Converter</h2>
    <v-card>
      <v-card-text>
        <p>
          Upload your image to convert it to G-code
        </p>
        <p>Supported formats: PNG, JPEG, SVG</p>
        
        <v-form ref="form" @submit.prevent="submit">
          <v-divider class="my-4"></v-divider>

          <!-- Processing Mode -->
          <p class="radio-title">Processing Mode</p>
          <v-radio-group
            v-model="mode"
            :error-messages="v$.mode.$errors.map(e => e.$message)"
            @update:model-value="onModeChange"
          >
            <v-radio label="Engraving" value="ME"></v-radio>
            <v-radio label="Carving" value="MC"></v-radio>
          </v-radio-group>

          <!-- File Upload -->
          <v-file-input
            v-model="file"
            show-size
            counter
            accept="image/png, image/jpeg, image/svg+xml"
            :rules="fileInputRules"
            :error-messages="v$.file.$errors.map(e => e.$message)"
            label="Upload Image"
            @update:model-value="onFileChange"
          ></v-file-input>

          <!-- Image Preview -->
          <div class="file-preview" v-if="imageUrl">
            <v-img
              :src="imageUrl"
              style="border: 1px dashed #ccc; min-height: 250px; max-height: 400px"
              contain
            />
          </div>

          <!-- Vectorized Image Preview (for SVG engraving) -->
          <div v-if="isSVG && mode === 'ME' && tracingMode" class="my-4">
            <p class="vectorized-title">Check vectorized image:</p>
            <div class="vectorized-image" v-html="fileURL"></div>
          </div>

          <!-- Filter Slider (for SVG engraving) -->
          <v-slider
            v-if="isSVG && mode === 'ME' && tracingMode"
            v-model="filterCoefficient"
            :ticks="ticksLabels"
            :max="4"
            :step="1"
            show-ticks="always"
            tick-size="4"
            color="primary"
            track-color="success"
            thumb-label
            label="Filter Strength"
            @update:model-value="getVectorized"
          >
            <template v-slot:tick-label="{ index }">
              {{ ticksLabels[index] }}
            </template>
          </v-slider>

          <!-- Background Switch (for SVG engraving) -->
          <v-switch
            v-if="isSVG && mode === 'ME' && tracingMode"
            v-model="background"
            color="primary"
            label="Set Background"
            @update:model-value="onBackgroundChange"
          ></v-switch>

          <!-- Tracing Mode (for SVG engraving) -->
          <div v-if="isSVG && mode === 'ME'" class="my-4">
            <p class="tracing-title">Type of Tracing</p>
            <v-radio-group
              v-model="tracingMode"
              :error-messages="v$.tracingMode.$errors.map(e => e.$message)"
              @update:model-value="onTracingModeChange"
            >
              <v-radio label="Outline" value="OT"></v-radio>
              <v-radio label="Centerline" value="CT"></v-radio>
            </v-radio-group>
          </div>

          <!-- Carving Parameters -->
          <template v-if="mode === 'MC'">
            <v-text-field
              v-model.number="workpieceThickness"
              :error-messages="v$.workpieceThickness.$errors.map(e => e.$message)"
              label="Workpiece Thickness (mm)"
              :rules="workpieceThicknessRules"
              type="number"
              variant="outlined"
              class="my-2"
            ></v-text-field>

            <v-text-field
              v-model.number="stepDepth"
              :error-messages="v$.stepDepth.$errors.map(e => e.$message)"
              label="Step Depth (mm)"
              :rules="stepDepthRules"
              type="number"
              variant="outlined"
              class="my-2"
            ></v-text-field>

            <v-select
              v-model="typeProcessing"
              :items="['out', 'in']"
              label="Type of Processing"
              variant="outlined"
              class="my-2"
            ></v-select>
          </template>

          <!-- Max Size (for SVG) -->
          <v-text-field
            v-if="isSVG"
            v-model.number="maxSize"
            :error-messages="v$.maxSize.$errors.map(e => e.$message)"
            label="Max Size (mm) - Reduce Image"
            type="number"
            variant="outlined"
            class="my-2"
          ></v-text-field>

          <!-- Tolerance -->
          <v-text-field
            v-model.number="tolerance"
            :error-messages="v$.tolerance.$errors.map(e => e.$message)"
            label="Tolerance"
            :rules="toleranceRules"
            type="number"
            step="0.01"
            variant="outlined"
            class="my-2"
          ></v-text-field>

          <!-- Feed Speed -->
          <v-text-field
            v-model.number="feedSpeed"
            :error-messages="v$.feedSpeed.$errors.map(e => e.$message)"
            label="Rapid Speed (mm/min)"
            :rules="rapidRules"
            type="number"
            variant="outlined"
            class="my-2"
          ></v-text-field>

          <!-- Cutting Speed -->
          <v-text-field
            v-model.number="cuttingSpeed"
            :error-messages="v$.cuttingSpeed.$errors.map(e => e.$message)"
            label="Cutting Speed (mm/min)"
            :rules="cuttingRules"
            type="number"
            variant="outlined"
            class="my-2"
          ></v-text-field>

          <!-- Coordinate Z -->
          <v-text-field
            v-model.number="coordinateZ"
            :error-messages="v$.coordinateZ.$errors.map(e => e.$message)"
            label="Z Coordinate (mm)"
            type="number"
            variant="outlined"
            class="my-2"
          ></v-text-field>

          <!-- Cutting Depth (for engraving) -->
          <v-text-field
            v-if="mode === 'ME'"
            v-model.number="cuttingDepth"
            :error-messages="v$.cuttingDepth.$errors.map(e => e.$message)"
            label="Cutting Depth (mm)"
            :rules="cuttingDepthRules"
            :messages="cuttingDepthWarnings"
            type="number"
            variant="outlined"
            class="my-2"
          ></v-text-field>

          <!-- Passes -->
          <v-text-field
            v-model.number="passes"
            :error-messages="v$.passes.$errors.map(e => e.$message)"
            label="Passes (default 1)"
            :rules="passesRules"
            type="number"
            variant="outlined"
            class="my-2"
          ></v-text-field>

          <!-- Pass Depth -->
          <v-text-field
            v-model.number="passDepth"
            :error-messages="v$.passDepth.$errors.map(e => e.$message)"
            label="Pass Depth (default 1 mm)"
            :rules="passDepthRules"
            type="number"
            variant="outlined"
            class="my-2"
          ></v-text-field>

          <!-- Header -->
          <v-textarea
            v-model="header"
            :error-messages="v$.header.$errors.map(e => e.$message)"
            label="Header G-code"
            variant="outlined"
            rows="3"
            class="my-2"
          ></v-textarea>

          <!-- End -->
          <v-textarea
            v-model="end"
            :error-messages="v$.end.$errors.map(e => e.$message)"
            label="End G-code"
            variant="outlined"
            rows="3"
            class="my-2"
          ></v-textarea>

          <!-- Submit Button -->
          <v-btn
            type="submit"
            color="success"
            size="large"
            :disabled="processingFrozen"
            class="mt-4"
          >
            Process Image
          </v-btn>

          <!-- Response Messages -->
          <div class="response mt-4">
            <v-alert v-if="submitStatus === 'OK'" type="success">
              G-code generated successfully! File downloaded.
            </v-alert>
            <v-alert v-if="submitStatus === 'ERROR'" type="error">
              {{ backendError }}
            </v-alert>
            <v-alert v-if="submitStatus === 'PENDING'" type="info">
              <span v-if="mode === 'ME'">Processing...</span>
              <span v-else>Processing may take a few minutes...</span>
            </v-alert>
          </div>
        </v-form>

        <!-- Progress Bar -->
        <v-progress-linear
          v-if="loadingProgressBar"
          indeterminate
          color="success"
          class="mt-4"
        ></v-progress-linear>
      </v-card-text>
    </v-card>

    <!-- Snackbar -->
    <v-snackbar
      v-model="snackbar"
      :timeout="3000"
      location="top right"
      color="success"
    >
      <v-icon start>mdi-alert-circle</v-icon>
      {{ snackbarText }}
      <template v-slot:actions>
        <v-btn size="small" @click="snackbar = false">X</v-btn>
      </template>
    </v-snackbar>

    <!-- 3D Canvas -->
    <div v-if="showCanvas" class="mt-4">
      <v-card>
        <v-card-title>G-code Preview</v-card-title>
        <v-card-text>
          <ThreeCanvasHelp
            :gcode-source="generatedGcodeText"
          />
        </v-card-text>
      </v-card>
    </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import axios from 'axios'
import { useVuelidate } from '@vuelidate/core'
import { required, numeric, decimal, requiredIf } from '@vuelidate/validators'
import ThreeCanvasHelp from './ThreeCanvasHelp.vue'

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

const props = defineProps({
  authToken: {
    type: String,
    required: true
  }
})

// Data
const file = ref(null)
const imageUrl = ref('')
const feedSpeed = ref('')
const cuttingSpeed = ref('')
const coordinateZ = ref('')
const cuttingDepth = ref('')
const workpieceThickness = ref('')
const stepDepth = ref('')
const typeProcessing = ref('out')
const header = ref('G17\nG90\nG0 X0 Y0\nM3 S800')
const end = ref('M5')
const submitStatus = ref('')
const backendError = ref('')
const snackbar = ref(false)
const snackbarText = ref('')
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
const generatedGcodeText = ref('')
const showCanvas = ref(false)
const carvingStatus = ref('')
const carvingTask = ref('')
const processingFrozen = ref(false)
const passDepth = ref('')
const passes = ref('')

const ticksLabels = [
  'No Filter',
  'Weak Filter',
  'Middle Filter',
  'Strong Filter',
  'Extra Strong Filter'
]

// Validation Rules
const fileInputRules = [
  value => !value || value.size <= 1024 * 1000 * 15 || 'Image size should be less than 15 MB',
  value => !value || value.size >= 1024 * 1 || 'Image size should be greater than 1 KB',
  value => !value || ['image/svg+xml', 'image/jpeg', 'image/png'].includes(value.type) || 'This type of file not accepted'
]

const cuttingRules = [
  value => !value || value < 6000 || 'Value should be less than 6000',
  value => !value || value > 10 || 'Value should be greater than 10'
]

const rapidRules = [
  value => !value || value < 10000 || 'Value should be less than 10000',
  value => !value || value > 100 || 'Value should be greater than 100'
]

const toleranceRules = [
  value => !value || value <= 5 || 'Value should be less than 5',
  value => !value || value >= 0.01 || 'Value should be greater or equal 0.01'
]

const workpieceThicknessRules = [
  value => !value || value >= 5 || 'Value should be greater or equal 5'
]

const stepDepthRules = [
  value => !value || value > 0 || 'Value should be greater than 0'
]

const passDepthRules = [
  value => !value || value < 15 || 'Value should be less than 15 mm',
  value => !value || value > 0 || 'Value should be greater than 0'
]

const passesRules = [
  value => !value || value <= 20 || 'Value must be less than or equal to 20',
  value => !value || value > 0 || 'Value must be greater than 0'
]

const cuttingDepthRules = [
  value => value > 0 || 'Value must be greater than 0',
  value => value <= 24 || 'Value must be less than or equal to 24 mm'
]

// Vuelidate setup
const rules = {
  file: { required },
  feedSpeed: { numeric },
  cuttingSpeed: { numeric },
  coordinateZ: { numeric },
  cuttingDepth: { numeric },
  maxSize: { numeric },
  tolerance: { decimal },
  mode: { required },
  tracingMode: {
    required: requiredIf(() => mode.value === 'ME' && isSVG.value === true)
  },
  header: { required },
  end: { required },
  workpieceThickness: { numeric },
  stepDepth: { numeric },
  passes: { numeric },
  passDepth: { numeric }
}

const v$ = useVuelidate(rules, {
  file,
  feedSpeed,
  cuttingSpeed,
  coordinateZ,
  cuttingDepth,
  maxSize,
  tolerance,
  mode,
  tracingMode,
  header,
  end,
  workpieceThickness,
  stepDepth,
  passes,
  passDepth
})

// Computed
const cuttingDepthWarnings = computed(() => {
  if (passes.value === '' || passDepth.value === '' || cuttingDepth.value === '') {
    return []
  }
  const max = passes.value * passDepth.value
  if (cuttingDepth.value > max) {
    return [`Cutting depth exceeds passes × pass depth (${max} mm)`]
  }
  return []
})

const generatedGcodePreview = computed(() => {
  if (!generatedGcodeText.value) return ''
  const lines = generatedGcodeText.value.split('\n')
  return lines.slice(0, 100).join('\n') + (lines.length > 100 ? '\n\n... (truncated)' : '')
})

// Methods
const createImage = (file) => {
  const reader = new FileReader()
  reader.onload = e => {
    imageUrl.value = e.target.result
  }
  reader.readAsDataURL(file)
}

const onModeChange = () => {
  if (file.value && mode.value === 'ME') {
    onFileChange(file.value)
  }
}

const onTracingModeChange = (val) => {
  if (!bgUserOverride.value) {
    background.value = (val === 'CT')
  }
  getVectorized()
}

const onBackgroundChange = () => {
  bgUserOverride.value = true
  getVectorized()
}

const onFileChange = (newFile) => {
  if (!newFile) return
  
  file.value = newFile
  
  if (newFile.type !== 'image/svg+xml') {
    isSVG.value = true
    if (mode.value === 'ME' || mode.value === '') {
      getVectorized()
    }
  } else {
    isSVG.value = false
  }
  
  createImage(newFile)
  backendError.value = ''
}

const getFitler = () => {
  const filterMap = {
    0: 0,
    1: 2,
    2: 4,
    3: 6,
    4: 10
  }
  return filterMap[filterCoefficient.value] || 0
}

const fetchCarvingStatus = async (taskId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/converter/v1/get-status`, {
      headers: { Authorization: `Token ${props.authToken}` },
      params: { task_id: taskId }
    })
    carvingStatus.value = response.data?.status
  } catch (error) {
    backendError.value = error.response?.data || 'Error fetching status'
    submitStatus.value = 'ERROR'
  }
}

const downloadFile = async (taskId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/converter/v1/get-carving`, {
      headers: { Authorization: `Token ${props.authToken}` },
      params: { task_id: taskId }
    })
    
    const fileURL = window.URL.createObjectURL(new Blob([response.data]))
    const fileLink = document.createElement('a')
    fileLink.href = fileURL
    
    let contentDisposition = response.headers['content-disposition']
    if (/=\?utf-8\?b\?/i.test(contentDisposition)) {
      const b64 = contentDisposition.match(/=\?utf-8\?b\?(.*?)\?=/i)[1]
      const decoded = atob(b64)
      contentDisposition = new TextDecoder('utf-8').decode(
        Uint8Array.from(decoded, c => c.charCodeAt(0))
      )
    }
    
    const fileName = contentDisposition.split(';')[1].split('=')[1].replace(/"/g, '')
    fileLink.setAttribute('download', fileName)
    document.body.appendChild(fileLink)
    fileLink.click()
    
    submitStatus.value = 'OK'
    loadingProgressBar.value = false
    processingFrozen.value = false
    generatedGcodeText.value = response.data
    showCanvas.value = true
  } catch (error) {
    backendError.value = error.response?.data || 'Error downloading file'
    submitStatus.value = 'ERROR'
    loadingProgressBar.value = false
    processingFrozen.value = false
  }
}

const checkCarvingStatus = async (taskId) => {
  while (true) {
    await fetchCarvingStatus(taskId)
    const status = carvingStatus.value
    
    if (status === 'SUCCESS') {
      await downloadFile(taskId)
      break
    } else if (status === 'FAILURE') {
      loadingProgressBar.value = false
      processingFrozen.value = false
      submitStatus.value = 'ERROR'
      break
    }
    await new Promise(resolve => setTimeout(resolve, 10000))
  }
}

const submit = async () => {
  console.log('submit!')
  showCanvas.value = false
  
  const isValid = await v$.value.$validate()
  if (!isValid) {
    submitStatus.value = 'ERROR'
    backendError.value = 'Please fill all required fields correctly'
    return
  }
  
  await converter()
}

const converter = async () => {
  submitStatus.value = 'PENDING'
  loadingProgressBar.value = true
  processingFrozen.value = true
  
  const filter = getFitler()
  const formData = new FormData()
  
  if (feedSpeed.value !== '') formData.append('movement_speed', feedSpeed.value)
  if (cuttingSpeed.value !== '') formData.append('cutting_speed', cuttingSpeed.value)
  if (coordinateZ.value !== '') formData.append('coordinate_z', coordinateZ.value)
  if (cuttingDepth.value !== '') formData.append('cutting_depth', cuttingDepth.value)
  if (file.value) formData.append('file', file.value)
  if (maxSize.value !== '') formData.append('max_size', maxSize.value)
  if (filterCoefficient.value !== 0) formData.append('filter_coefficient', filter)
  formData.append('background', background.value)
  if (tolerance.value !== '') formData.append('tolerance', tolerance.value)
  if (mode.value !== '') formData.append('mode', mode.value)
  if (tracingMode.value !== '') formData.append('tracing_mode', tracingMode.value)
  if (header.value !== '') formData.append('header', header.value)
  if (end.value !== '') formData.append('end', end.value)
  if (workpieceThickness.value !== '') formData.append('workpiece_thickness', workpieceThickness.value)
  if (stepDepth.value !== '') formData.append('step_depth', stepDepth.value)
  if (typeProcessing.value !== '') formData.append('type_processing', typeProcessing.value)
  if (passDepth.value !== '') formData.append('pass_depth', passDepth.value)
  if (passes.value !== '') formData.append('passes', passes.value)
  
  let endpoint = ''
  switch (mode.value) {
    case 'ME':
      endpoint = `${API_BASE_URL}/api/converter/v1/milling-engraving`
      break
    case 'MC':
      endpoint = `${API_BASE_URL}/api/converter/v1/milling-carving`
      break
    default:
      submitStatus.value = 'ERROR'
      backendError.value = 'Unknown mode: ' + mode.value
      snackbarText.value = backendError.value
      snackbar.value = true
      loadingProgressBar.value = false
      processingFrozen.value = false
      return
  }
  
  try {
    const response = await axios({
      method: 'post',
      url: endpoint,
      data: formData,
      headers: {
        Authorization: `Token ${props.authToken}`,
        'Content-Type': 'multipart/form-data'
      }
    })
    
    if (response.status === 200) {
      const fileURL = window.URL.createObjectURL(new Blob([response.data]))
      const fileLink = document.createElement('a')
      fileLink.href = fileURL
      
      let contentDisposition = response.headers['content-disposition']
      if (/=\?utf-8\?b\?/i.test(contentDisposition)) {
        const b64 = contentDisposition.match(/=\?utf-8\?b\?(.*?)\?=/i)[1]
        const decoded = atob(b64)
        contentDisposition = new TextDecoder('utf-8').decode(
          Uint8Array.from(decoded, c => c.charCodeAt(0))
        )
      }
      
      const fileName = contentDisposition.split(';')[1].split('=')[1].replace(/"/g, '') + '.nc'
      fileLink.setAttribute('download', fileName)
      document.body.appendChild(fileLink)
      fileLink.click()
      
      submitStatus.value = 'OK'
      loadingProgressBar.value = false
      processingFrozen.value = false
      generatedGcodeText.value = response.data
      showCanvas.value = true
    } else if (response.status === 202) {
      carvingStatus.value = response.data.status
      carvingTask.value = response.data.task_id
      await checkCarvingStatus(carvingTask.value)
    } else {
      submitStatus.value = 'ERROR'
      loadingProgressBar.value = false
      processingFrozen.value = false
    }
  } catch (error) {
    console.error('Converter error:', error)
    submitStatus.value = 'ERROR'
    loadingProgressBar.value = false
    processingFrozen.value = false
    backendError.value = error.response?.data?.detail || error.response?.data || error.message
    
    if (backendError.value === 'Invalid token.') {
      snackbarText.value = 'Only registered users can create G-code'
      backendError.value = 'Only registered users can create G-code'
    } else {
      snackbarText.value = backendError.value
    }
    snackbar.value = true
  }
}

const getVectorized = async () => {
  if (tracingMode.value === '') return
  
  const filter = getFitler()
  const formData = new FormData()
  
  if (file.value) formData.append('file', file.value)
  if (filterCoefficient.value !== 0) formData.append('filter_coefficient', filter)
  if (maxSize.value !== '') formData.append('max_size', maxSize.value)
  formData.append('background', background.value)
  if (tracingMode.value !== '') formData.append('tracing_mode', tracingMode.value)
  
  try {
    const response = await axios({
      method: 'post',
      url: `${API_BASE_URL}/api/converter/v1/get-vectorized`,
      data: formData,
      headers: {
        Authorization: `Token ${props.authToken}`,
        'Content-Type': 'multipart/form-data'
      }
    })
    
    if (response.status === 200) {
      fileURL.value = response.data
      submitStatus.value = ''
    } else {
      submitStatus.value = 'ERROR'
    }
  } catch (error) {
    console.error('Vectorization error:', error)
    submitStatus.value = 'ERROR'
    backendError.value = error.response?.data?.detail || error.response?.data || error.message
    
    if (backendError.value === 'Invalid token.') {
      snackbarText.value = 'Only registered users can create G-code'
      backendError.value = 'Only registered users can create G-code'
    } else {
      snackbarText.value = backendError.value
    }
    snackbar.value = true
  }
}
</script>

<style scoped>
.response {
  margin-top: 16px;
}

.radio-title {
  font-weight: 500;
  margin-top: 16px;
  margin-bottom: 8px;
}

.tracing-title {
  font-weight: 500;
  margin-top: 20px;
  margin-bottom: 8px;
}

.create-title {
  padding: 16px 0;
}

.file-preview {
  margin: 16px 0;
}

.vectorized-title {
  font-weight: 500;
  margin-bottom: 8px;
}

.vectorized-image {
  width: 100%;
  max-height: 80vh;
  overflow: auto;
  border: 1px solid #e0e0e0;
  padding: 8px;
  border-radius: 4px;
}
</style>
