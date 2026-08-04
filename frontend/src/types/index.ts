export interface Coordinate { lng: number; lat: number }
export interface CityPoi extends Coordinate { id: string; name: string }
export interface City { code: string; name: string; province: string; center: Coordinate; zoom: number; districts: string[]; scenarios: string[]; description: string; pois: CityPoi[] }
export interface Segment { id: string; name: string; district: string; coordinates: Coordinate[]; average_speed: number; flow: number; weather_factor: number; event_factor: number; congestion_index: number; congestion_level: string }
export interface Event { id: string; type: string; title: string; level: string; district: string; location: Coordinate; description: string }
export interface TrendPoint { time: string; congestion_index: number }
export interface Summary { city: string; congestion_index: number; congestion_level: string; average_speed: number; active_events: number; monitored_segments: number; congested_segments: number; updated_at: string; data_mode: string; top_congested: Segment[] }
export interface PredictionPoint { after_minutes: number; congestion_index: number; congestion_level: string }
export interface Prediction { city: string; model: string; horizon_minutes: number; baseline_index: number; confidence: number; items: PredictionPoint[]; high_risk_segments: Segment[]; factors: string[]; explanation: string }
export interface Place extends Coordinate { id: string; name: string }
export interface RouteOption { strategy: string; title: string; distance_km: number; estimated_minutes: number; congestion_score: number; safety_score: number; carbon_kg?: number; path: Coordinate[]; advice: string }
export interface RouteResult { city: string; origin: Place; destination: Place; items: RouteOption[] }
export interface Warning { id: string; type: string; level: string; title: string; district: string; segment_id: string | null; status: string; occurred_at: string; impact: string; suggestion: string }
export interface WhatIfRequest { event_type: 'waterlog' | 'accident'; target_segment: string; water_depth_cm?: number }
export interface WhatIfResult { affected_segments: string[]; spread_trend: number[]; comparison: { before_speed_kmh: number; after_speed_kmh: number; optimized_speed_kmh: number }; sop_actions: string[] }
export type CitizenPreference = 'fastest' | 'congestion_avoid' | 'safe_first'
export interface CitizenHomeSummary { city: string; travel_safety_index: number; weather_notice: string; peak_notice: string; recommended_transport: string[]; updated_at: string; data_mode: string }
export interface CitizenSmartPlanRequest { city: string; origin: string; destination: string; preference: CitizenPreference }
export interface CitizenSmartPlan { route_id: string; city: string; strategy: CitizenPreference; total_distance_km: number; estimated_minutes: number; avoided_risks: string[]; path_nodes: string[]; path: Coordinate[]; data_mode: string }
export interface CitizenTripMonitor { route_id: string; has_risk_ahead: boolean; risk_type: 'waterlog' | 'accident' | 'congestion' | null; description: string; reroute_available: boolean; next_risk_segment?: string; distance_to_risk_km?: number; updated_at: string; data_mode: string }
export interface CitizenBusBookingRequest { city?: string; user_id: string; shift_time: string; line_id: string }
export interface CitizenBusBooking { booking_id: string; city: string; user_id: string; line_id: string; shift_time: string; status: 'confirmed'; remaining_seats: number; message: string; data_mode: string }
export interface CitizenCommuteLine { line_id: string; name: string; departure_times: string[]; remaining_seats: number }
export interface MobilityPoi extends Coordinate { id: string; name: string; category: string; address: string; distance_km?: number; walking_minutes?: number }
export interface MobilityWeather { city: string; condition: string; temperature_c: number; feels_like_c: number; humidity: number; wind: string; visibility_km: number; advice: string; updated_at: string; data_mode: string }
export interface TaxiEstimate { city: string; distance_km: number; estimated_minutes: number; estimated_fare_yuan: number; surge_level: string; data_mode: string }
export interface SmsChallenge { challenge_id: string; expires_in_seconds: number; demo_code: string; data_mode: string }
export interface MobilityUser { user_id: string; masked_phone: string; display_name: string; token: string; data_mode: string }
export interface OfflinePackManifest { city: string; name: string; version: string; size_bytes: number; download_url: string; contents: string[] }
export interface OfflinePack { format: string; city: string; version: string; data_mode: string; city_info: City; segments: Segment[]; events: Event[] }
