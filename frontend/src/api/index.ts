import axios from 'axios'
import * as mock from '../mock/data'
import * as citizenMock from '../mock/citizen'
import * as mobilityMock from '../mock/mobility'
import type { City, CitizenBusBooking, CitizenBusBookingRequest, CitizenCommuteLine, CitizenHomeSummary, CitizenSmartPlan, CitizenSmartPlanRequest, CitizenTripMonitor, Event, MobilityPoi, MobilityUser, MobilityWeather, OfflinePack, OfflinePackManifest, Prediction, RouteResult, Segment, SmsChallenge, Summary, TaxiEstimate, TrendPoint, Warning, WhatIfRequest, WhatIfResult } from '../types'

const http = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000', timeout: 6000 })
const useMock = () => import.meta.env.VITE_USE_MOCK !== 'false'
const useCitizenMock = () => import.meta.env.VITE_CITIZEN_USE_MOCK !== 'false'
export const DEFAULT_CITY = import.meta.env.VITE_DEFAULT_CITY || 'beijing'

export const api = {
  async cities(): Promise<City[]> {
    return useMock() ? mock.cities : (await http.get('/api/cities')).data.items
  },
  async summary(city = DEFAULT_CITY): Promise<Summary> {
    return useMock() ? mock.summary(city) : (await http.get('/api/traffic/summary', { params: { city } })).data
  },
  async segments(city = DEFAULT_CITY): Promise<Segment[]> {
    return useMock() ? mock.segments(city) : (await http.get('/api/traffic/segments', { params: { city } })).data.items
  },
  async events(city = DEFAULT_CITY): Promise<Event[]> {
    return useMock() ? mock.events(city) : (await http.get('/api/traffic/events', { params: { city } })).data.items
  },
  async trend(city = DEFAULT_CITY): Promise<TrendPoint[]> {
    return useMock() ? mock.trend(city) : (await http.get('/api/traffic/trend', { params: { city } })).data.items
  },
  async prediction(city = DEFAULT_CITY, horizon: number): Promise<Prediction> {
    return useMock() ? mock.prediction(city, horizon) : (await http.get('/api/prediction/congestion', { params: { city, horizon_minutes: horizon } })).data
  },
  async route(city: string, origin: string, destination: string): Promise<RouteResult> {
    return useMock() ? mock.route(city, origin, destination) : (await http.get('/api/route/recommend', { params: { city, origin, destination } })).data
  },
  async warnings(city = DEFAULT_CITY): Promise<Warning[]> {
    return useMock() ? mock.warnings(city) : (await http.get('/api/warning/active', { params: { city } })).data.items
  },
  async whatIf(city: string, payload: WhatIfRequest): Promise<WhatIfResult> {
    if (useMock()) return mock.whatIf(city, payload)
    return (await http.post('/api/simulation/what-if', { city, ...payload })).data.data
  },
  async citizenHomeSummary(city = DEFAULT_CITY): Promise<CitizenHomeSummary> {
    return useCitizenMock() ? citizenMock.citizenHomeSummary(city) : (await http.get('/api/citizen/home-summary', { params: { city } })).data
  },
  async citizenSmartPlan(payload: CitizenSmartPlanRequest): Promise<CitizenSmartPlan> {
    return useCitizenMock() ? citizenMock.citizenSmartPlan(payload) : (await http.post('/api/citizen/route/smart-plan', payload)).data
  },
  async citizenTripMonitor(routeId: string): Promise<CitizenTripMonitor> {
    return useCitizenMock() ? citizenMock.citizenTripMonitor(routeId) : (await http.get('/api/citizen/trip/monitor', { params: { route_id: routeId } })).data
  },
  async citizenCommuteLines(city = DEFAULT_CITY): Promise<CitizenCommuteLine[]> {
    return useCitizenMock() ? citizenMock.citizenCommuteLines(city) : (await http.get('/api/citizen/commute/lines', { params: { city } })).data.items
  },
  async citizenBusBooking(payload: CitizenBusBookingRequest): Promise<CitizenBusBooking> {
    return useCitizenMock() ? citizenMock.citizenBusBooking(payload) : (await http.post('/api/citizen/commute/bus-booking', payload)).data
  },
  async mobilitySearch(city: string, query: string): Promise<MobilityPoi[]> {
    return useMock() ? mobilityMock.mobilitySearch(city, query) : (await http.get('/api/mobility/search', { params: { city, q: query } })).data.items
  },
  async mobilityNearby(city: string, lng: number, lat: number, category = 'all'): Promise<MobilityPoi[]> {
    return useMock() ? mobilityMock.mobilityNearby(city, lng, lat, category) : (await http.get('/api/mobility/nearby', { params: { city, lng, lat, category } })).data.items
  },
  async mobilityWeather(city: string): Promise<MobilityWeather> {
    return useMock() ? mobilityMock.mobilityWeather(city) : (await http.get('/api/mobility/weather', { params: { city } })).data
  },
  async mobilityTaxi(city: string, origin: { lng: number; lat: number }, destination: { lng: number; lat: number }): Promise<TaxiEstimate> {
    if (useMock()) return mobilityMock.mobilityTaxi(city, origin, destination)
    return (await http.get('/api/mobility/taxi-estimate', { params: { city, origin_lng: origin.lng, origin_lat: origin.lat, destination_lng: destination.lng, destination_lat: destination.lat } })).data
  },
  async requestSmsCode(phone: string): Promise<SmsChallenge> {
    return useMock() ? mobilityMock.requestSms(phone) : (await http.post('/api/mobility/auth/request-code', { phone })).data
  },
  async verifySmsCode(phone: string, code: string): Promise<MobilityUser> {
    return useMock() ? mobilityMock.verifySms(phone, code) : (await http.post('/api/mobility/auth/verify-code', { phone, code })).data
  },
  async offlinePacks(): Promise<OfflinePackManifest[]> {
    return (await http.get('/api/mobility/offline-packs')).data.items
  },
  async downloadOfflinePack(city: string): Promise<OfflinePack> {
    return (await http.get(`/api/mobility/offline-packs/${city}`)).data
  },
}
