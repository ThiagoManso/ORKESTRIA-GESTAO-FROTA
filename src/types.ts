export type ViewState = 'dashboard' | 'routes' | 'drivers' | 'financial' | 'issues' | 'map' | 'vehicles' | 'settings';

export interface RouteItem {
  id: string;
  routeNumber?: number;
  status: 'pending' | 'in_progress' | 'completed' | 'issue';
  driver: string;
  origin?: string;
  destination?: string;
  intermediates?: string[];
  optimizeOrder?: boolean;
  departureTime?: string;
  lat?: number;
  lng?: number;
  stops: number;
  distance: number;
  estimatedTime: string;
  date: string;
  stopDetails?: { id: string; address: string; status: 'pending' | 'completed' | 'issue' }[];
}

export interface Driver {
  id: string;
  name: string;
  email?: string;
  whatsapp?: string;
  phone?: string;
  cpf?: string;
  cnh?: string;
  vehicleType?: string;
  vehiclePlate?: string;
  vehicle: string;
  rating: number;
  status: 'active' | 'offline' | 'on_route' | 'pending_approval';
  completed: number;
}

export interface Vehicle {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  capacity: number; // In kg
  type: 'motorcycle' | 'car' | 'van' | 'truck';
  status: 'active' | 'maintenance' | 'inactive';
}
