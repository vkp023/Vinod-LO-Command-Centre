export type Designation = 'Master LO' | 'LO' | 'Sub-LO';
export type ApprovalStatus = 'Pending' | 'Approved' | 'Disapproved';
export type HierarchyRule = '1_to_1' | '1_to_5' | 'unlimited';
export type DeploymentMode = 'web' | 'mobile' | 'both';
export type MetricMeaning = 'live_counts' | 'allocations' | 'custom';
export type PickupStatus = 'Scheduled' | 'En Route' | 'Picked Up' | 'Delayed';
export type DropoffStatus = 'Scheduled' | 'In Transit' | 'Dropped Off' | 'Pending';
export type RegistrationStatus = 'Pending' | 'Confirmed' | 'Completed' | 'Cancelled';

export interface SystemConfig {
  id: string;
  ownerId: string;
  hierarchyRule: HierarchyRule;
  deploymentMode: DeploymentMode;
  metricMeaning: MetricMeaning;
  dayanandRole: Designation;
  delegateTarget: number;
  arrivalTarget: number;
  departureTarget: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Officer {
  id: string;
  ownerId: string;
  officerCode: string;
  fullName: string;
  designation: Designation;
  companyName: string;
  registrationNumber: string;
  badgeCategory: string;
  assignedMasterLoId: string;
  assignedLoId: string;
  assignedSubLoId: string;
  approvalStatus: ApprovalStatus;
  airportAssignment: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface OfficerVault {
  id: string;
  ownerId: string;
  officerId: string;
  contactNumber: string;
  idDocumentType: string;
  idDocumentNumber: string;
  signatureText: string;
  photoStyle: string;
  verifiedByStaff: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AssignmentLog {
  id: string;
  ownerId: string;
  subLoId: string;
  subLoName: string;
  subLoCode: string;
  previousLoName: string;
  newLoId: string;
  newLoName: string;
  hierarchyRuleApplied: string;
  createdAt?: unknown;
}

export interface DelegateRecord {
  id: string;
  ownerId: string;
  delegateName: string;
  registrationNumber: string;
  company: string;
  badgeCategory: string;
  contactNumber: string;
  masterLoId: string;
  loId: string;
  subLoId: string;
  assignedHandler: string;
  arrivalAirport: string;
  arrivalFlight: string;
  arrivalDateTime: string;
  pickupStatus: PickupStatus;
  departureAirport: string;
  departureFlight: string;
  departureDateTime: string;
  dropoffStatus: DropoffStatus;
  hotelName: string;
  hotelAddress: string;
  checkInDateTime: string;
  checkOutDateTime: string;
  roomDetails: string;
  vehicleNumber: string;
  vehicleType: string;
  driverName: string;
  driverContact: string;
  pickupSchedule: string;
  registrationStatus: RegistrationStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type NavigationTab =
  | 'overview'
  | 'lo_list'
  | 'sub_lo_list'
  | 'registration'
  | 'configuration'
  | 'delegates'
  | 'airport_transport'
  | 'hotels'
  | 'documents_reports'
  | 'lo_app';
