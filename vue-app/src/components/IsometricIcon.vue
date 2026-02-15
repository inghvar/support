<template>
  <v-tooltip text="Isometric View" location="top">
    <template v-slot:activator="{ props }">
      <img src="../assets/isometric_view.svg" v-bind="props" />
    </template>
  </v-tooltip>
</template>
