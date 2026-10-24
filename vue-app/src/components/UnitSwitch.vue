<template>
  <div class="unit-switch">
    <p>Units</p>
    <v-radio-group
      :model-value="modelValue"
      inline
      hide-details
      @update:model-value="emit('update:modelValue', $event)"
    >
      <v-radio label="Millimeters (mm)" value="mm"></v-radio>
      <v-radio label="Inches (in)" value="in"></v-radio>
    </v-radio-group>
  </div>
</template>

<script setup>
defineProps({
  modelValue: {
    type: String,
    default: 'mm',
  },
})
const emit = defineEmits(['update:modelValue'])
</script>
