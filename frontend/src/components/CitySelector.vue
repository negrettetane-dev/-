<script setup lang="ts">
import { MapPin } from '@lucide/vue'
import { useCityStore } from '../stores/cityStore'

const cityStore = useCityStore()
</script>

<template>
  <label class="city-selector">
    <MapPin :size="15" />
    <span>治理区域</span>
    <select v-model="cityStore.currentCityCode" aria-label="选择治理城市" @change="cityStore.setCity(cityStore.currentCityCode)">
      <option v-for="city in cityStore.cities" :key="city.code" :value="city.code">{{ city.name }}</option>
    </select>
  </label>
</template>
