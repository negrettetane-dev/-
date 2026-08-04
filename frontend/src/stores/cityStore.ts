import { defineStore } from 'pinia'
import { api } from '../api'
import { cities as mockCities } from '../mock/data'
import type { City } from '../types'

const fallbackCities: City[] = mockCities

export const useCityStore = defineStore('city', {
  state: () => ({
    currentCityCode: localStorage.getItem('toc-city') || import.meta.env.VITE_DEFAULT_CITY || 'beijing',
    cities: fallbackCities as City[],
    loading: false,
  }),
  getters: {
    currentCity(state): City {
      return state.cities.find(city => city.code === state.currentCityCode) || state.cities[0]
    },
  },
  actions: {
    setCity(cityCode: string) {
      if (!this.cities.some(city => city.code === cityCode)) return
      this.currentCityCode = cityCode
      localStorage.setItem('toc-city', cityCode)
    },
    async hydrate() {
      this.loading = true
      try {
        const cities = await api.cities()
        if (cities.length) {
          this.cities = cities
          if (!cities.some(city => city.code === this.currentCityCode)) this.setCity(cities[0].code)
        }
      } catch {
        // Keep the static catalog available for offline demonstration.
      } finally {
        this.loading = false
      }
    },
  },
})
