export type ViewState = 'dashboard' | 'routes' | 'drivers' | 'financial' | 'issues' | 'map' | 'vehicles' | 'settings' | 'requests' | 'users' | 'my_requests';

export interface ExternalRequest {
  id: string;
  type: 'coleta' | 'entrega';
  address: string;
  dropoffAddress?: string;
  osNumber?: string;
  orderNumber?: string;
  requesterName: string;
  contactPhone: string;
  observations?: string;
  scheduledDate: string;
  status: 'pending' | 'on_route' | 'completed';
  read: boolean;
  createdAt: string;
  userId?: string; // Links the request to an internal user
  recurrenceId?: string; // If generated automatically
}

export interface RecurringRequest {
  id: string;
  type: 'coleta' | 'entrega';
  address: string;
  osNumber?: string;
  orderNumber?: string;
  requesterName: string;
  contactPhone: string;
  observations?: string;
  userId: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  weekDays?: number[]; // 0=Sunday, 1=Monday, ..., 6=Saturday
  monthDay?: number; // 1-31
  active: boolean;
  createdAt: string;
}

export interface SystemUser {
  id: string;
  name: string;
  email: string;
  sector: string;
  status: 'pending_approval' | 'approved' | 'rejected';
  role: 'admin' | 'internal_user';
  permissions: ViewState[];
}

export interface RouteItem {
  id: string;
  driver: string;
  status: 'pending' | 'in_progress' | 'completed' | 'issue';
  stops: number;
  distance: number;
  date: string;
  departureTime?: string;
  estimatedTime?: string;
  estimatedMinutes?: number;
  origin?: string;
  destination?: string;
  intermediates?: string[];
  routeNumber?: number;
  stopDetails?: {
    id: string;
    address: string;
    type?: 'coleta' | 'entrega';
    dropoffAddress?: string;
    collectionCompleted?: boolean;
    dropoffReceiverName?: string;
    dropoffPhotoUrl?: string;
    status: 'pending' | 'completed' | 'issue';
    orderNumber?: string;
    customerName?: string;
    customerPhone?: string;
    observation?: string;
    externalRequestId?: string;
  }[];
  returnToMatriz?: boolean;
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
  initialKm?: number;
}

export interface DailyLog {
  id: string;
  driverId: string;
  driverName: string;
  vehicleId: string;
  vehiclePlate: string;
  date: string; // YYYY-MM-DD
  initialKm: number;
  finalKm?: number;
  checklist: {
    extinguisher: boolean;
    tools: boolean;
    seatbelt: boolean;
    tires: boolean;
    oil: boolean;
    water: boolean;
    brakes: boolean;
    dashboardLights: boolean;
    headlights: boolean;
    turnSignals: boolean;
    brakeLights: boolean;
    mirrors: boolean;
    wipers: boolean;
    cleaning: boolean;
    doors: boolean;
    structure: boolean;
    tieDowns: boolean;
    bodywork: boolean;
  };
  observations?: string;
  status: 'active' | 'completed';
}
