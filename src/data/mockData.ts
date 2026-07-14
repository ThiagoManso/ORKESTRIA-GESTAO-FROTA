import { RouteItem, Vehicle } from '../types';

export const INITIAL_VEHICLES: Vehicle[] = [
  { id: '1', plate: 'ABC-1234', brand: 'Volkswagen', model: 'Saveiro', year: 2020, capacity: 700, type: 'car', status: 'active' },
  { id: '2', plate: 'XYZ-9876', brand: 'Mercedes-Benz', model: 'Sprinter', year: 2022, capacity: 1500, type: 'van', status: 'active' },
  { id: '3', plate: 'DEF-5678', brand: 'Honda', model: 'CG 160', year: 2021, capacity: 20, type: 'motorcycle', status: 'maintenance' },
  { id: '4', plate: 'GHI-9012', brand: 'Fiat', model: 'Fiorino', year: 2019, capacity: 650, type: 'van', status: 'active' },
  { id: '5', plate: 'JKL-3456', brand: 'Ford', model: 'Cargo 816', year: 2018, capacity: 8000, type: 'truck', status: 'inactive' },
];

export const INITIAL_ROUTES: RouteItem[] = [
  { id: '7891070', status: 'in_progress', driver: 'Edvaldo', stops: 51, distance: 66.4, estimatedTime: '03:33 h', date: 'Hoje', lat: -23.5505, lng: -46.6333 },
  { id: '7892747', status: 'completed', driver: 'Alexandre', stops: 1, distance: 21.0, estimatedTime: '00:36 h', date: 'Hoje', lat: -23.5615, lng: -46.6550 },
  { id: '7893348', status: 'completed', driver: 'João', stops: 3, distance: 21.4, estimatedTime: '00:39 h', date: 'Ontem', lat: -23.5420, lng: -46.6390 },
  { id: '7893262', status: 'in_progress', driver: 'Juraci', stops: 43, distance: 31.4, estimatedTime: '02:23 h', date: 'Hoje', lat: -23.5820, lng: -46.6800 },
  { id: '7893409', status: 'pending', driver: 'Aguardando', stops: 10, distance: 55.9, estimatedTime: '04:15 h', date: 'Amanhã', lat: -23.5200, lng: -46.6100 },
];
