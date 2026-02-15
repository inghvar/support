<template>
  <v-tooltip text="Top View" location="top">
    <template v-slot:activator="{ props }">
      <img src="../assets/top_view.svg" v-bind="props" />
    </template>
  </v-tooltip>
</template>
