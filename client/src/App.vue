<script setup>
import { provide } from 'vue'
import { useTheme } from './composables/useTheme'

const { theme, toggleTheme } = useTheme()

// Provide theme utilities to children
provide('theme', theme)
provide('toggleTheme', toggleTheme)
</script>

<template>
  <router-view />
</template>

<style>
/* App-level styles are in global.css */
</style>
