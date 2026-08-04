import { createRouter, createWebHistory } from 'vue-router'
import AppLayout from '../layout/AppLayout.vue'
const router = createRouter({ history: createWebHistory(), routes: [{ path: '/', component: AppLayout, redirect: '/dashboard', children: [
  { path: 'dashboard', component: () => import('../views/DashboardView.vue') },
  { path: 'map', component: () => import('../views/MapView.vue') },
  { path: 'mobility', component: () => import('../views/MobilityView.vue') },
  { path: 'prediction', component: () => import('../views/PredictionView.vue') },
  { path: 'route', component: () => import('../views/RouteView.vue') },
  { path: 'warnings', component: () => import('../views/WarningView.vue') },
  { path: 'simulation', component: () => import('../views/SimulationView.vue') },
] }, { path: '/:pathMatch(.*)*', component: () => import('../views/NotFoundView.vue') }] })
export default router
