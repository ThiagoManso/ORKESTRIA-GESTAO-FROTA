export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  status: 'active' | 'inactive' | 'pending';
  name?: string;
  createdAt: any;
  lastLocation?: { lat: number, lng: number, speed?: number | null };
  locationUpdatedAt?: any;
  isTrackingActive?: boolean;
  fcmToken?: string;
}

export interface GlobalSettings {
  id: string;
  headquarterAddress: string;
  updatedAt: any;
}

export type UserRole = 'admin' | 'manager' | 'operator' | 'driver' | 'purchasing';

export interface PurchaseRequest {
  id: string;
  requestedBy: string;
  department: string;
  specification: string;
  urgencyDate?: string;
  status: 'pending' | 'quoting' | 'approved' | 'rejected' | 'completed';
  createdAt: any;
  updatedAt: any;
  notes?: string;
}

export interface Vehicle {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  currentMileage: number;
  lastMaintenanceKm?: number;
  status: 'active' | 'maintenance' | 'inactive';
  isVirtual?: boolean;
  maintenanceStartDate?: any;
  ownerId: string;
  createdAt: any;
  updatedAt: any;
}

export interface MaintenanceRecord {
  id: string;
  vehicleId: string;
  date: any;
  type: 'preventive' | 'corrective';
  description: string;
  cost: number;
  mileageAtService: number;
  washedVehicle?: boolean;
  ownerId: string;
  createdAt: any;
}

export interface MaintenanceSchedule {
  id: string;
  vehicleId: string;
  serviceType: string;
  scheduledDate: any;
  targetMileage?: number;
  status: 'pending' | 'completed' | 'overdue';
  estimatedDowntimeDays?: number;
  suggestedServices?: string[];
  suggestedParts?: string[];
  dailyAverageKm?: number;
  ownerId: string;
}

export interface VehicleLog {
  id: string;
  vehicleId: string;
  driverName: string;
  startTime: any;
  endTime?: any;
  startMileage: number;
  endMileage?: number;
  purpose: string;
  currentLat?: number;
  currentLng?: number;
  currentSpeed?: number | null;
  currentHeading?: number | null;
  status: 'active' | 'completed';
  ownerId: string;
  updatedAt?: any;
}

export interface Checklist {
  id: string;
  logId?: string;
  vehicleId: string;
  items: Record<string, string>;
  fuelLevel: string;
  observations: string;
  ownerId: string;
  createdAt: any;
}

export interface CollectionRequest {
  id: string;
  title: string;
  address: string;
  lat?: number;
  lng?: number;
  status: 'pending' | 'assigned' | 'accepted' | 'refused' | 'completed' | 'delivered_manual';
  batchId?: string;
  observations?: string;
  assignedDriverId?: string;
  assignedVehicleId?: string;
  refusalReason?: string;
  type: 'coleta' | 'entrega';
  priority: 'low' | 'medium' | 'high';
  scheduledDate?: any;
  completedAt?: any;
  ownerId: string;
  createdAt: any;
  updatedAt: any;
}

export interface Driver {
  id: string;
  name: string;
  licenseNumber: string;
  licenseCategory: string;
  licenseExpiry: any;
  phone: string;
  status: 'active' | 'inactive';
  isVirtual?: boolean;
  userId?: string;
  ownerId: string;
  createdAt: any;
}

export interface Fine {
  id: string;
  vehicleId: string;
  driverId: string;
  date: any;
  amount: number;
  description: string;
  status: 'pending' | 'paid' | 'appealing';
  ownerId: string;
  createdAt: any;
}

export type FirestoreErrorInfo = {
  error: string;
  operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
  path: string | null;
  authInfo: {
    userId: string;
    email: string;
    emailVerified: boolean;
    isAnonymous: boolean;
    providerInfo: { providerId: string; displayName: string; email: string; }[];
  }
}

export interface RouteManifest {
  id: string;
  driverId: string;
  date: any;
  status: 'pending' | 'in_progress' | 'completed';
  requestIds: string[];
  optimizedPolyline?: string;
  optimizationType?: 'time' | 'distance' | 'eco';
  estimatedTimeSeconds?: number;
  estimatedDistanceMeters?: number;
  ownerId: string;
  createdAt: any;
  updatedAt: any;
}
