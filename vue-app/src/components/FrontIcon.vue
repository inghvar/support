<template>
  <v-tooltip text="Front View" location="top">
    <template v-slot:activator="{ props }">
      <img src="../assets/front_view.svg" v-bind="props" />
    </template>
  </v-tooltip>
</template>
