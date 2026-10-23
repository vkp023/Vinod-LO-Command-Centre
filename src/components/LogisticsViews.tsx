import React, { useState } from 'react';
import {
  FileSpreadsheet,
  FileDown,
  PlaneLanding,
  PlaneTakeoff,
  Building2,
  Car,
  Plus,
  Trash2,
  Smartphone,
  Monitor,
  Check,
  Wand2,
  Phone,
  MapPin,
} from 'lucide-react';
import {
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  Officer,
  OfficerVault,
  DelegateRecord,
  AssignmentLog,
  SystemConfig,
  PickupStatus,
  DropoffStatus,
  RegistrationStatus,
} from '../types';
import {
  exportMasterExcelWorkbook,
  exportIndividualLoPdf,
} from '../utils/exportReports';
import { OfficerPortraitSvg } from './OfficerVaultModal';

interface LogisticsProps {
  officers: Officer[];
  vaultMap: Record<string, OfficerVault>;
  delegates: DelegateRecord[];
  assignmentLogs: AssignmentLog[];
  config: SystemConfig | null;
  currentUserId: string | null;
  onSelectOfficerForVault: (officer: Officer) => void;
  onLocalDelegateCreate: (del: DelegateRecord) => void;
  onLocalDelegateUpdate: (
    id: string,
    patch: Partial<DelegateRecord>
  ) => void;
  onLocalDelegateDelete: (id: string) => void;
}

export const DelegateManagementView: React.FC<LogisticsProps> = ({
  officers,
  delegates,
  currentUserId,
  onLocalDelegateCreate,
  onLocalDelegateUpdate,
  onLocalDelegateDelete,
}) => {
  const masterLos = officers.filter((o) => o.designation === 'Master LO');
  const approvedLos = officers.filter(
    (o) => o.designation === 'LO' && o.approvalStatus === 'Approved'
  );
  const approvedSubLos = officers.filter(
    (o) => o.designation === 'Sub-LO' && o.approvalStatus === 'Approved'
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showForm, setShowForm] = useState(false);

  // Delegate Registration Form State
  const [delegateName, setDelegateName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState(
    `DEL-2026-${800 + delegates.length + 1}`
  );
  const [company, setCompany] = useState('');
  const [badgeCategory, setBadgeCategory] = useState('Executive Delegate');
  const [contactNumber, setContactNumber] = useState('+91 98200 11223');
  const [masterLoId, setMasterLoId] = useState(masterLos[0]?.id || '');
  const [loId, setLoId] = useState(approvedLos[0]?.id || '');
  const [subLoId, setSubLoId] = useState(approvedSubLos[0]?.id || '');
  const [assignedHandler, setAssignedHandler] = useState('');
  const [arrivalAirport, setArrivalAirport] = useState('CSMIA Terminal 2');
  const [arrivalFlight, setArrivalFlight] = useState('BA-139 (LHR -> BOM)');
  const [arrivalDateTime, setArrivalDateTime] = useState('2026-10-24 06:45');
  const [pickupStatus, setPickupStatus] = useState<PickupStatus>('Scheduled');
  const [departureAirport, setDepartureAirport] = useState('CSMIA Terminal 2');
  const [departureFlight, setDepartureFlight] = useState('BA-138 (BOM -> LHR)');
  const [departureDateTime, setDepartureDateTime] = useState('2026-10-27 13:20');
  const [dropoffStatus, setDropoffStatus] = useState<DropoffStatus>('Scheduled');
  const [hotelName, setHotelName] = useState('The Taj Mahal Palace');
  const [hotelAddress, setHotelAddress] = useState(
    'Apollo Bunder, Colaba, Mumbai'
  );
  const [checkInDateTime, setCheckInDateTime] = useState('2026-10-24 08:30');
  const [checkOutDateTime, setCheckOutDateTime] = useState('2026-10-27 10:00');
  const [roomDetails, setRoomDetails] = useState('Luxury Grande Room 604');
  const [vehicleNumber, setVehicleNumber] = useState('MH-01-DB-0012');
  const [vehicleType, setVehicleType] = useState('Mercedes-Benz E-Class Sedan');
  const [driverName, setDriverName] = useState('Prakash Kadam');
  const [driverContact, setDriverContact] = useState('+91 98204 77112');
  const [pickupSchedule, setPickupSchedule] = useState(
    '06:30 Terminal 2 Gate A2 VIP Curb'
  );
  const [registrationStatus, setRegistrationStatus] =
    useState<RegistrationStatus>('Confirmed');
  const [submitting, setSubmitting] = useState(false);

  const officerMap = new Map<string, Officer>();
  officers.forEach((o) => officerMap.set(o.id, o));

  const handleSampleAutofill = () => {
    const sampleNames = [
      {
        name: 'Ambassador Mira Kapoor',
        org: 'Indo-European Trade Council',
        badge: 'VVIP Head of Delegation',
        flightIn: 'AF-218 (CDG -> BOM)',
        flightOut: 'AF-217 (BOM -> CDG)',
        hotel: 'The Oberoi Mumbai',
        room: 'Kohinoor Suite 1501',
        car: 'MH-01-DB-0018',
      },
      {
        name: 'Lord Henrik Lindqvist',
        org: 'Nordic Sovereign Climate Fund',
        badge: 'Ministerial Envoy',
        flightIn: 'LX-154 (ZRH -> BOM)',
        flightOut: 'LX-155 (BOM -> ZRH)',
        hotel: 'The Taj Mahal Palace',
        room: 'Tata Suite 1201 — Palace Wing',
        car: 'MH-01-DB-0021',
      },
    ];
    const pick = sampleNames[delegates.length % sampleNames.length];
    setDelegateName(pick.name);
    setCompany(pick.org);
    setBadgeCategory(pick.badge);
    setArrivalFlight(pick.flightIn);
    setDepartureFlight(pick.flightOut);
    setHotelName(pick.hotel);
    setRoomDetails(pick.room);
    setVehicleNumber(pick.car);
    setRegistrationNumber(`DEL-2026-${800 + delegates.length + 1}`);
  };

  const handleCreateDelegate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!delegateName.trim()) return;
    setSubmitting(true);

    const selectedSubLo = officerMap.get(subLoId);
    const computedHandler =
      assignedHandler.trim() ||
      (selectedSubLo
        ? `${selectedSubLo.fullName} (Sub-LO ${selectedSubLo.officerCode})`
        : 'Protocol Desk');

    const newId = `del_${(currentUserId || 'demo').slice(0, 8)}_${Date.now()}`;
    const baseRecord: DelegateRecord = {
      id: newId,
      ownerId: currentUserId || 'demo-operator',
      delegateName: delegateName.trim().slice(0, 120),
      registrationNumber: registrationNumber.trim().slice(0, 64),
      company: company.trim().slice(0, 120) || 'International Delegation',
      badgeCategory: badgeCategory.trim().slice(0, 64),
      contactNumber: contactNumber.trim().slice(0, 40),
      masterLoId: masterLoId || masterLos[0]?.id || '',
      loId: loId || approvedLos[0]?.id || '',
      subLoId: subLoId || '',
      assignedHandler: computedHandler.slice(0, 120),
      arrivalAirport: arrivalAirport.trim().slice(0, 120),
      arrivalFlight: arrivalFlight.trim().slice(0, 40),
      arrivalDateTime: arrivalDateTime.trim().slice(0, 64),
      pickupStatus,
      departureAirport: departureAirport.trim().slice(0, 120),
      departureFlight: departureFlight.trim().slice(0, 40),
      departureDateTime: departureDateTime.trim().slice(0, 64),
      dropoffStatus,
      hotelName: hotelName.trim().slice(0, 120),
      hotelAddress: hotelAddress.trim().slice(0, 200),
      checkInDateTime: checkInDateTime.trim().slice(0, 64),
      checkOutDateTime: checkOutDateTime.trim().slice(0, 64),
      roomDetails: roomDetails.trim().slice(0, 80),
      vehicleNumber: vehicleNumber.trim().slice(0, 40),
      vehicleType: vehicleType.trim().slice(0, 64),
      driverName: driverName.trim().slice(0, 120),
      driverContact: driverContact.trim().slice(0, 40),
      pickupSchedule: pickupSchedule.trim().slice(0, 120),
      registrationStatus,
    };

    if (currentUserId) {
      const { id: _unused, ...firestorePayload } = baseRecord;
      try {
        await setDoc(doc(db, 'delegates', newId), {
          ...firestorePayload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `delegates/${newId}`);
      }
    } else {
      onLocalDelegateCreate(baseRecord);
    }

    setDelegateName('');
    setCompany('');
    setRegistrationNumber(`DEL-2026-${800 + delegates.length + 2}`);
    setShowForm(false);
    setSubmitting(false);
  };

  const handleUpdateStatus = async (
    del: DelegateRecord,
    newRegStatus: RegistrationStatus
  ) => {
    if (currentUserId) {
      try {
        await updateDoc(doc(db, 'delegates', del.id), {
          pickupStatus: del.pickupStatus,
          dropoffStatus: del.dropoffStatus,
          registrationStatus: newRegStatus,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(
          err,
          OperationType.UPDATE,
          `delegates/${del.id}`
        );
      }
    } else {
      onLocalDelegateUpdate(del.id, { registrationStatus: newRegStatus });
    }
  };

  const handleDeleteDelegate = async (id: string) => {
    if (currentUserId) {
      try {
        await deleteDoc(doc(db, 'delegates', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `delegates/${id}`);
      }
    } else {
      onLocalDelegateDelete(id);
    }
  };

  const filteredDelegates = delegates.filter((d) => {
    const matchesSearch =
      d.delegateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.registrationNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.assignedHandler.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === 'ALL' || d.registrationStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E6E4DD] pb-5">
        <div>
          <h2 className="text-2xl font-display font-bold tracking-tight text-[#14213D]">
            VIP Delegate Registry & Liaison Allocation
          </h2>
          <p className="text-sm text-[#57534E] mt-1">
            Register visiting dignitaries, link Master LO / LO / Sub-LO teams,
            and manage end-to-end flight, hotel suite, and chauffeur schedules.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#1D4ED8] rounded-xl hover:bg-[#1E40AF] transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          {showForm ? 'Close Registration Form' : 'Register New Delegate'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreateDelegate}
          className="bg-white border border-[#E6E4DD] rounded-2xl p-6 space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E6E4DD] pb-4">
            <div>
              <h3 className="text-base font-bold text-[#14213D]">
                Delegate Registration Form
              </h3>
              <p className="text-xs text-[#57534E] mt-0.5">
                Enter delegate details, assigned team, arrival/departure
                flights, hotel room, and protocol vehicle.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSampleAutofill}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-[#14213D] bg-[#F7F6F2] border border-[#D6D3CD] rounded-lg hover:bg-[#E6E4DD]/60 transition-colors whitespace-nowrap shrink-0"
            >
              <Wand2 className="w-3.5 h-3.5 text-[#1D4ED8]" />
              Fill Sample Delegate
            </button>
          </div>

          {/* Section 1: Delegate Details */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-[#14213D]">
              01. Delegate Identity & Badge Category
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#57534E] mb-1">
                  Delegate Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={delegateName}
                  onChange={(e) => setDelegateName(e.target.value)}
                  placeholder="e.g. Ambassador Mira Kapoor"
                  className="w-full px-3.5 py-2 text-sm border border-[#D6D3CD] rounded-lg focus:outline-none focus:border-[#1D4ED8]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#57534E] mb-1">
                  Registration Number *
                </label>
                <input
                  type="text"
                  required
                  value={registrationNumber}
                  onChange={(e) => setRegistrationNumber(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-[#D6D3CD] rounded-lg focus:outline-none focus:border-[#1D4ED8] font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#57534E] mb-1">
                  Company / Organization *
                </label>
                <input
                  type="text"
                  required
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. Ministry of Trade & Industry"
                  className="w-full px-3.5 py-2 text-sm border border-[#D6D3CD] rounded-lg focus:outline-none focus:border-[#1D4ED8]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#57534E] mb-1">
                  Badge Category
                </label>
                <select
                  value={badgeCategory}
                  onChange={(e) => setBadgeCategory(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-[#D6D3CD] rounded-lg focus:outline-none focus:border-[#1D4ED8] bg-white"
                >
                  <option value="VVIP Head of Delegation">
                    VVIP Head of Delegation
                  </option>
                  <option value="Ministerial Envoy">Ministerial Envoy</option>
                  <option value="Executive Delegate">Executive Delegate</option>
                  <option value="Special Guest">Special Guest</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#57534E] mb-1">
                  Contact Number
                </label>
                <input
                  type="text"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-[#D6D3CD] rounded-lg focus:outline-none focus:border-[#1D4ED8] font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#57534E] mb-1">
                  Registration Status
                </label>
                <select
                  value={registrationStatus}
                  onChange={(e) =>
                    setRegistrationStatus(e.target.value as RegistrationStatus)
                  }
                  className="w-full px-3.5 py-2 text-sm border border-[#D6D3CD] rounded-lg focus:outline-none focus:border-[#1D4ED8] bg-white"
                >
                  <option value="Pending">Pending</option>
                  <option value="Confirmed">Confirmed</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Assigned Team */}
          <div className="pt-4 border-t border-[#E6E4DD] space-y-3">
            <div className="text-xs font-bold text-[#14213D]">
              02. Assigned Liaison Officer Team
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#57534E] mb-1">
                  Master LO
                </label>
                <select
                  value={masterLoId}
                  onChange={(e) => setMasterLoId(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-[#D6D3CD] rounded-lg focus:outline-none focus:border-[#1D4ED8] bg-white"
                >
                  {masterLos.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fullName} ({m.officerCode})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#57534E] mb-1">
                  Assigned LO (Approved)
                </label>
                <select
                  value={loId}
                  onChange={(e) => setLoId(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-[#D6D3CD] rounded-lg focus:outline-none focus:border-[#1D4ED8] bg-white"
                >
                  {approvedLos.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.fullName} ({l.officerCode})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#57534E] mb-1">
                  Assigned Sub-LO (Approved)
                </label>
                <select
                  value={subLoId}
                  onChange={(e) => setSubLoId(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-[#D6D3CD] rounded-lg focus:outline-none focus:border-[#1D4ED8] bg-white"
                >
                  {approvedSubLos.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} (ID: {s.officerCode})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#57534E] mb-1">
                  Assigned Delegate Handler
                </label>
                <input
                  type="text"
                  value={assignedHandler}
                  onChange={(e) => setAssignedHandler(e.target.value)}
                  placeholder="Auto-filled from Sub-LO"
                  className="w-full px-3.5 py-2 text-sm border border-[#D6D3CD] rounded-lg focus:outline-none focus:border-[#1D4ED8]"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Arrival & Departure */}
          <div className="pt-4 border-t border-[#E6E4DD] space-y-3">
            <div className="text-xs font-bold text-[#14213D]">
              03. Airport Arrival & Departure Details
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#57534E] mb-1">
                  Arrival Airport
                </label>
                <input
                  type="text"
                  value={arrivalAirport}
                  onChange={(e) => setArrivalAirport(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-[#D6D3CD] rounded-lg focus:outline-none focus:border-[#1D4ED8]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#57534E] mb-1">
                  Arrival Flight Number
                </label>
                <input
                  type="text"
                  value={arrivalFlight}
                  onChange={(e) => setArrivalFlight(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-[#D6D3CD] rounded-lg focus:outline-none focus:border-[#1D4ED8] font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#57534E] mb-1">
                  Arrival Date & Time
                </label>
                <input
                  type="text"
                  value={arrivalDateTime}
                  onChange={(e) => setArrivalDateTime(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-[#D6D3CD] rounded-lg focus:outline-none focus:border-[#1D4ED8] font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#57534E] mb-1">
                  Pickup Status
                </label>
                <select
                  value={pickupStatus}
                  onChange={(e) =>
                    setPickupStatus(e.target.value as PickupStatus)
                  }
                  className="w-full px-3.5 py-2 text-sm border border-[#D6D3CD] rounded-lg focus:outline-none focus:border-[#1D4ED8] bg-white"
                >
                  <option value="Scheduled">Scheduled</option>
                  <option value="En Route">En Route</option>
                  <option value="Picked Up">Picked Up</option>
                  <option value="Delayed">Delayed</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#57534E] mb-1">
                  Departure Airport
                </label>
                <input
                  type="text"
                  value={departureAirport}
                  onChange={(e) => setDepartureAirport(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-[#D6D3CD] rounded-lg focus:outline-none focus:border-[#1D4ED8]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#57534E] mb-1">
                  Departure Flight Number
                </label>
                <input
                  type="text"
                  value={departureFlight}
                  onChange={(e) => setDepartureFlight(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-[#D6D3CD] rounded-lg focus:outline-none focus:border-[#1D4ED8] font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#57534E] mb-1">
                  Departure Date & Time
                </label>
                <input
                  type="text"
                  value={departureDateTime}
                  onChange={(e) => setDepartureDateTime(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-[#D6D3CD] rounded-lg focus:outline-none focus:border-[#1D4ED8] font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#57534E] mb-1">
                  Drop-off Status
                </label>
                <select
                  value={dropoffStatus}
                  onChange={(e) =>
                    setDropoffStatus(e.target.value as DropoffStatus)
                  }
                  className="w-full px-3.5 py-2 text-sm border border-[#D6D3CD] rounded-lg focus:outline-none focus:border-[#1D4ED8] bg-white"
                >
                  <option value="Scheduled">Scheduled</option>
                  <option value="In Transit">In Transit</option>
                  <option value="Dropped Off">Dropped Off</option>
                  <option value="Pending">Pending</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 4: Hotel & Car Details */}
          <div className="pt-4 border-t border-[#E6E4DD] space-y-3">
            <div className="text-xs font-bold text-[#14213D]">
              04. Hotel Stay & Protocol Car Details
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#57534E] mb-1">
                  Hotel Name
                </label>
                <input
                  type="text"
                  value={hotelName}
                  onChange={(e) => setHotelName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-[#D6D3CD] rounded-lg focus:outline-none focus:border-[#1D4ED8]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#57534E] mb-1">
                  Hotel Address
                </label>
                <input
                  type="text"
                  value={hotelAddress}
                  onChange={(e) => setHotelAddress(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-[#D6D3CD] rounded-lg focus:outline-none focus:border-[#1D4ED8]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#57534E] mb-1">
                  Check-In Date & Time
                </label>
                <input
                  type="text"
                  value={checkInDateTime}
                  onChange={(e) => setCheckInDateTime(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-[#D6D3CD] rounded-lg focus:outline-none focus:border-[#1D4ED8] font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#57534E] mb-1">
                  Check-Out Date & Time
                </label>
                <input
                  type="text"
                  value={checkOutDateTime}
                  onChange={(e) => setCheckOutDateTime(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-[#D6D3CD] rounded-lg focus:outline-none focus:border-[#1D4ED8] font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#57534E] mb-1">
                  Room / Suite Details
                </label>
                <input
                  type="text"
                  value={roomDetails}
                  onChange={(e) => setRoomDetails(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-[#D6D3CD] rounded-lg focus:outline-none focus:border-[#1D4ED8]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#57534E] mb-1">
                  Vehicle Number
                </label>
                <input
                  type="text"
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-[#D6D3CD] rounded-lg focus:outline-none focus:border-[#1D4ED8] font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#57534E] mb-1">
                  Vehicle Type
                </label>
                <input
                  type="text"
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-[#D6D3CD] rounded-lg focus:outline-none focus:border-[#1D4ED8]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#57534E] mb-1">
                  Driver Name
                </label>
                <input
                  type="text"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-[#D6D3CD] rounded-lg focus:outline-none focus:border-[#1D4ED8]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#57534E] mb-1">
                  Driver Contact
                </label>
                <input
                  type="text"
                  value={driverContact}
                  onChange={(e) => setDriverContact(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-[#D6D3CD] rounded-lg focus:outline-none focus:border-[#1D4ED8] font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#57534E] mb-1">
                  Pickup Schedule
                </label>
                <input
                  type="text"
                  value={pickupSchedule}
                  onChange={(e) => setPickupSchedule(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-[#D6D3CD] rounded-lg focus:outline-none focus:border-[#1D4ED8]"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E6E4DD]">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-xs font-medium text-[#57534E] border border-[#D6D3CD] rounded-lg hover:bg-[#F7F6F2] transition-colors whitespace-nowrap shrink-0"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-[#1D4ED8] rounded-lg hover:bg-[#1E40AF] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              {submitting ? 'Saving Record...' : 'Save Delegate Registration'}
            </button>
          </div>
        </form>
      )}

      {/* Search & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search delegate name, registration code, delegation, or handler..."
          className="w-full sm:max-w-md px-4 py-2.5 text-sm bg-white border border-[#D6D3CD] rounded-xl focus:outline-none focus:border-[#1D4ED8]"
        />
        <div className="flex items-center gap-1 p-1 bg-[#E6E4DD]/70 rounded-xl self-start">
          {(
            ['ALL', 'Pending', 'Confirmed', 'Completed', 'Cancelled'] as const
          ).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === st
                  ? 'bg-white text-[#14213D] shadow-xs'
                  : 'text-[#57534E] hover:text-[#1C1917]'
              }`}
            >
              {st === 'ALL' ? 'All Delegates' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Delegate Table */}
      <div className="bg-white border border-[#E6E4DD] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E6E4DD] bg-[#F7F6F2] text-xs font-semibold text-[#57534E]">
                <th className="py-3.5 px-5">Delegate & Delegation</th>
                <th className="py-3.5 px-4">Assigned Liaison Team</th>
                <th className="py-3.5 px-4">Arrival & Departure Flights</th>
                <th className="py-3.5 px-4">Hotel & Protocol Car</th>
                <th className="py-3.5 px-4">Registration Status</th>
                <th className="py-3.5 px-5 text-right">Remove</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E4DD] text-sm">
              {filteredDelegates.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-[#57534E]">
                    No delegate records match your current filter.
                  </td>
                </tr>
              ) : (
                filteredDelegates.map((d) => {
                  const lo = officerMap.get(d.loId);
                  const subLo = officerMap.get(d.subLoId);
                  return (
                    <tr
                      key={d.id}
                      className="hover:bg-[#F7F6F2]/60 transition-colors"
                    >
                      <td className="py-4 px-5 align-top">
                        <div className="font-bold text-[#14213D]">
                          {d.delegateName}
                        </div>
                        <div className="text-xs text-[#57534E] mt-0.5">
                          <span>{d.company}</span>
                          <span className="mx-1.5">·</span>
                          <span className="font-mono tabular-nums">
                            {d.registrationNumber}
                          </span>
                        </div>
                        <div className="text-xs text-[#78716C] mt-1 font-mono tabular-nums">
                          {d.badgeCategory} · {d.contactNumber}
                        </div>
                      </td>
                      <td className="py-4 px-4 align-top text-xs text-[#57534E]">
                        <div>
                          <span className="text-[#78716C]">LO:</span>{' '}
                          <span className="font-semibold text-[#1C1917]">
                            {lo?.fullName || 'Rushi'}
                          </span>
                        </div>
                        <div className="mt-0.5">
                          <span className="text-[#78716C]">Sub-LO:</span>{' '}
                          <span className="font-semibold text-[#1C1917]">
                            {subLo
                              ? `${subLo.fullName} (ID ${subLo.officerCode})`
                              : d.assignedHandler}
                          </span>
                        </div>
                        <div className="mt-1 text-[#78716C]">
                          Handler: {d.assignedHandler}
                        </div>
                      </td>
                      <td className="py-4 px-4 align-top text-xs font-mono tabular-nums">
                        <div className="text-[#1C1917] font-medium">
                          In: {d.arrivalFlight} ({d.arrivalDateTime})
                        </div>
                        <div className="text-[#047857] font-medium">
                          Pickup: {d.pickupStatus}
                        </div>
                        <div className="text-[#1C1917] font-medium mt-1.5">
                          Out: {d.departureFlight} ({d.departureDateTime})
                        </div>
                        <div className="text-[#57534E]">
                          Drop-off: {d.dropoffStatus}
                        </div>
                      </td>
                      <td className="py-4 px-4 align-top text-xs">
                        <div className="font-semibold text-[#14213D]">
                          {d.hotelName}
                        </div>
                        <div className="text-[#57534E]">{d.roomDetails}</div>
                        <div className="text-[#1C1917] mt-1.5 font-mono tabular-nums">
                          {d.vehicleNumber} · {d.driverName}
                        </div>
                      </td>
                      <td className="py-4 px-4 align-top">
                        <select
                          value={d.registrationStatus}
                          onChange={(e) =>
                            handleUpdateStatus(
                              d,
                              e.target.value as RegistrationStatus
                            )
                          }
                          className="px-3 py-1.5 text-xs font-semibold border border-[#D6D3CD] rounded-lg bg-white text-[#1C1917] focus:outline-none focus:border-[#1D4ED8]"
                        >
                          <option value="Pending">Pending</option>
                          <option value="Confirmed">Confirmed</option>
                          <option value="Completed">Completed</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      </td>
                      <td className="py-4 px-5 align-top text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteDelegate(d.id)}
                          className="p-2 text-[#78716C] hover:text-[#B91C1C] rounded-lg hover:bg-red-50 transition-colors"
                          title="Delete delegate record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export const AirportTransportView: React.FC<LogisticsProps> = ({
  delegates,
  currentUserId,
  onLocalDelegateUpdate,
}) => {
  const handleUpdateFlightLogistics = async (
    del: DelegateRecord,
    pickupStatus: PickupStatus,
    dropoffStatus: DropoffStatus
  ) => {
    if (currentUserId) {
      try {
        await updateDoc(doc(db, 'delegates', del.id), {
          pickupStatus,
          dropoffStatus,
          registrationStatus: del.registrationStatus,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(
          err,
          OperationType.UPDATE,
          `delegates/${del.id}`
        );
      }
    } else {
      onLocalDelegateUpdate(del.id, { pickupStatus, dropoffStatus });
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-[#E6E4DD] pb-5">
        <h2 className="text-2xl font-display font-bold tracking-tight text-[#14213D]">
          Airport Arrivals, Departures & Protocol Fleet
        </h2>
        <p className="text-sm text-[#57534E] mt-1">
          Coordinate terminal pickups, outbound drop-offs, tarmac schedules, and
          assigned executive vehicles.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Arrivals Board */}
        <div className="bg-white border border-[#E6E4DD] rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#E6E4DD] pb-3.5">
            <div className="flex items-center gap-2.5">
              <PlaneLanding className="w-5 h-5 text-[#1D4ED8]" />
              <h3 className="text-base font-bold text-[#14213D]">
                Inbound Arrivals & Tarmac Pickup
              </h3>
            </div>
            <span className="text-xs text-[#57534E] font-mono tabular-nums">
              {delegates.length} Inbound Flights
            </span>
          </div>

          <div className="divide-y divide-[#E6E4DD]">
            {delegates.map((d) => (
              <div key={d.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-bold text-[#14213D]">
                      {d.delegateName}
                    </div>
                    <div className="text-xs text-[#57534E] mt-0.5 font-mono tabular-nums">
                      {d.arrivalAirport} · {d.arrivalFlight} · ETA{' '}
                      {d.arrivalDateTime}
                    </div>
                    <div className="text-xs text-[#78716C] mt-1">
                      Handler: {d.assignedHandler} · Bay: {d.pickupSchedule}
                    </div>
                  </div>
                  <select
                    value={d.pickupStatus}
                    onChange={(e) =>
                      handleUpdateFlightLogistics(
                        d,
                        e.target.value as PickupStatus,
                        d.dropoffStatus
                      )
                    }
                    className="px-3 py-1.5 text-xs font-semibold border border-[#D6D3CD] rounded-lg bg-white text-[#1C1917] focus:outline-none focus:border-[#1D4ED8] shrink-0"
                  >
                    <option value="Scheduled">Scheduled</option>
                    <option value="En Route">En Route</option>
                    <option value="Picked Up">Picked Up</option>
                    <option value="Delayed">Delayed</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Departures Board */}
        <div className="bg-white border border-[#E6E4DD] rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#E6E4DD] pb-3.5">
            <div className="flex items-center gap-2.5">
              <PlaneTakeoff className="w-5 h-5 text-[#B45309]" />
              <h3 className="text-base font-bold text-[#14213D]">
                Outbound Departures & Terminal Drop-Off
              </h3>
            </div>
            <span className="text-xs text-[#57534E] font-mono tabular-nums">
              {delegates.length} Outbound Flights
            </span>
          </div>

          <div className="divide-y divide-[#E6E4DD]">
            {delegates.map((d) => (
              <div key={d.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-bold text-[#14213D]">
                      {d.delegateName}
                    </div>
                    <div className="text-xs text-[#57534E] mt-0.5 font-mono tabular-nums">
                      {d.departureAirport} · {d.departureFlight} · ETD{' '}
                      {d.departureDateTime}
                    </div>
                    <div className="text-xs text-[#78716C] mt-1">
                      Handler: {d.assignedHandler} · Car: {d.vehicleNumber}
                    </div>
                  </div>
                  <select
                    value={d.dropoffStatus}
                    onChange={(e) =>
                      handleUpdateFlightLogistics(
                        d,
                        d.pickupStatus,
                        e.target.value as DropoffStatus
                      )
                    }
                    className="px-3 py-1.5 text-xs font-semibold border border-[#D6D3CD] rounded-lg bg-white text-[#1C1917] focus:outline-none focus:border-[#1D4ED8] shrink-0"
                  >
                    <option value="Scheduled">Scheduled</option>
                    <option value="In Transit">In Transit</option>
                    <option value="Dropped Off">Dropped Off</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Vehicle & Chauffeur Roster */}
      <div className="bg-white border border-[#E6E4DD] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E6E4DD] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Car className="w-5 h-5 text-[#14213D]" />
            <h3 className="text-base font-bold text-[#14213D]">
              Protocol Fleet & Chauffeur Assignments
            </h3>
          </div>
          <span className="text-xs text-[#57534E] font-mono tabular-nums">
            Assigned Vehicles: {delegates.length}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E6E4DD] bg-[#F7F6F2] text-xs font-semibold text-[#57534E]">
                <th className="py-3.5 px-5">Vehicle Number</th>
                <th className="py-3.5 px-4">Vehicle Specification</th>
                <th className="py-3.5 px-4">Assigned Dignitary</th>
                <th className="py-3.5 px-4">Chauffeur & Direct Line</th>
                <th className="py-3.5 px-5">Staging & Pickup Schedule</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E4DD] text-sm">
              {delegates.map((d) => (
                <tr key={d.id} className="hover:bg-[#F7F6F2]/60">
                  <td className="py-3.5 px-5 font-mono font-bold text-[#14213D] tabular-nums">
                    {d.vehicleNumber}
                  </td>
                  <td className="py-3.5 px-4 text-[#57534E]">{d.vehicleType}</td>
                  <td className="py-3.5 px-4 font-semibold text-[#1C1917]">
                    {d.delegateName}
                  </td>
                  <td className="py-3.5 px-4 text-xs font-mono tabular-nums text-[#57534E]">
                    {d.driverName} · {d.driverContact}
                  </td>
                  <td className="py-3.5 px-5 text-xs text-[#57534E]">
                    {d.pickupSchedule}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export const HotelManagementView: React.FC<LogisticsProps> = ({
  delegates,
  currentUserId,
  onLocalDelegateUpdate,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [roomInput, setRoomInput] = useState('');
  const [hotelInput, setHotelInput] = useState('');

  const startEdit = (d: DelegateRecord) => {
    setEditingId(d.id);
    setHotelInput(d.hotelName);
    setRoomInput(d.roomDetails);
  };

  const saveHotelEdit = async (d: DelegateRecord) => {
    const cleanHotel = hotelInput.trim().slice(0, 120);
    const cleanRoom = roomInput.trim().slice(0, 80);

    if (currentUserId) {
      try {
        await updateDoc(doc(db, 'delegates', d.id), {
          delegateName: d.delegateName,
          registrationNumber: d.registrationNumber,
          company: d.company,
          badgeCategory: d.badgeCategory,
          contactNumber: d.contactNumber,
          masterLoId: d.masterLoId,
          loId: d.loId,
          subLoId: d.subLoId,
          assignedHandler: d.assignedHandler,
          arrivalAirport: d.arrivalAirport,
          arrivalFlight: d.arrivalFlight,
          arrivalDateTime: d.arrivalDateTime,
          pickupStatus: d.pickupStatus,
          departureAirport: d.departureAirport,
          departureFlight: d.departureFlight,
          departureDateTime: d.departureDateTime,
          dropoffStatus: d.dropoffStatus,
          hotelName: cleanHotel,
          hotelAddress: d.hotelAddress,
          checkInDateTime: d.checkInDateTime,
          checkOutDateTime: d.checkOutDateTime,
          roomDetails: cleanRoom,
          vehicleNumber: d.vehicleNumber,
          vehicleType: d.vehicleType,
          driverName: d.driverName,
          driverContact: d.driverContact,
          pickupSchedule: d.pickupSchedule,
          registrationStatus: d.registrationStatus,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `delegates/${d.id}`);
      }
    } else {
      onLocalDelegateUpdate(d.id, {
        hotelName: cleanHotel,
        roomDetails: cleanRoom,
      });
    }
    setEditingId(null);
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-[#E6E4DD] pb-5">
        <h2 className="text-2xl font-display font-bold tracking-tight text-[#14213D]">
          Hotel Accommodations & Suite Allocations
        </h2>
        <p className="text-sm text-[#57534E] mt-1">
          Manage luxury hotel stays, suite numbers, check-in/check-out windows,
          and assigned liaison handlers.
        </p>
      </div>

      <div className="bg-white border border-[#E6E4DD] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E6E4DD] bg-[#F7F6F2] text-xs font-semibold text-[#57534E]">
                <th className="py-3.5 px-5">Delegate</th>
                <th className="py-3.5 px-4">Hotel Property & Address</th>
                <th className="py-3.5 px-4">Suite / Room Allocation</th>
                <th className="py-3.5 px-4">Check-In & Check-Out</th>
                <th className="py-3.5 px-4">Assigned Handler</th>
                <th className="py-3.5 px-5 text-right">Modify</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E4DD] text-sm">
              {delegates.map((d) => (
                <tr key={d.id} className="hover:bg-[#F7F6F2]/60">
                  <td className="py-4 px-5">
                    <div className="font-bold text-[#14213D]">
                      {d.delegateName}
                    </div>
                    <div className="text-xs text-[#57534E] font-mono tabular-nums mt-0.5">
                      {d.registrationNumber} · {d.badgeCategory}
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    {editingId === d.id ? (
                      <input
                        type="text"
                        value={hotelInput}
                        onChange={(e) => setHotelInput(e.target.value)}
                        className="w-full px-3 py-1.5 text-sm border border-[#D6D3CD] rounded-lg"
                      />
                    ) : (
                      <>
                        <div className="font-semibold text-[#1C1917] flex items-center gap-1.5">
                          <Building2 className="w-4 h-4 text-[#B45309]" />
                          {d.hotelName}
                        </div>
                        <div className="text-xs text-[#57534E] mt-0.5">
                          {d.hotelAddress}
                        </div>
                      </>
                    )}
                  </td>
                  <td className="py-4 px-4">
                    {editingId === d.id ? (
                      <input
                        type="text"
                        value={roomInput}
                        onChange={(e) => setRoomInput(e.target.value)}
                        className="w-full px-3 py-1.5 text-sm border border-[#D6D3CD] rounded-lg"
                      />
                    ) : (
                      <span className="text-[#1C1917] font-medium">
                        {d.roomDetails}
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-4 text-xs font-mono tabular-nums text-[#57534E]">
                    <div>Check-In: {d.checkInDateTime}</div>
                    <div className="mt-0.5">Check-Out: {d.checkOutDateTime}</div>
                  </td>
                  <td className="py-4 px-4 text-xs text-[#57534E] font-medium">
                    {d.assignedHandler}
                  </td>
                  <td className="py-4 px-5 text-right">
                    {editingId === d.id ? (
                      <button
                        type="button"
                        onClick={() => saveHotelEdit(d)}
                        className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#1D4ED8] rounded-lg hover:bg-[#1E40AF] whitespace-nowrap shrink-0"
                      >
                        Save Suite
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEdit(d)}
                        className="px-3.5 py-1.5 text-xs font-medium text-[#14213D] border border-[#D6D3CD] rounded-lg hover:bg-[#F7F6F2] whitespace-nowrap shrink-0"
                      >
                        Edit Suite
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export const DocumentsReportsView: React.FC<LogisticsProps> = ({
  officers,
  vaultMap,
  delegates,
  assignmentLogs,
  config,
  onSelectOfficerForVault,
}) => {
  const workbookSheets = [
    {
      num: '01',
      title: 'Master LO Overview',
      desc: 'Executive summary of total LOs, Sub-LOs, approval counts, active hierarchy rule, and arrival/departure metrics.',
    },
    {
      num: '02',
      title: 'LO Details',
      desc: 'Complete roster of Master LOs and LOs with registration numbers, badge categories, airport sectors, and Sub-LO team counts.',
    },
    {
      num: '03',
      title: 'Sub-LO Details',
      desc: 'Sub-LO directory (Poojan 001, Ronnie 002, Vinod 003, Prateekh 004) with approval statuses and assigned LOs.',
    },
    {
      num: '04',
      title: 'LO–Sub-LO Assignments',
      desc: 'Current reporting matrix and historical reassignment audit trail.',
    },
    {
      num: '05',
      title: 'Delegate Registration',
      desc: 'Master list of registered delegates, badge tiers, and assigned LO/Sub-LO handlers.',
    },
    {
      num: '06',
      title: 'Airport Arrivals & Departures',
      desc: 'Flight schedules, arrival terminals, pickup statuses, and outbound drop-off statuses.',
    },
    {
      num: '07',
      title: 'Hotel & Car Details',
      desc: 'Hotel check-in/out logs, room allocations, protocol vehicle numbers, and chauffeur contacts.',
    },
    {
      num: '08',
      title: 'Approval Status',
      desc: 'Compliance and credential verification status for every registered officer.',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Master Excel Workbook Section */}
      <div className="bg-white border border-[#E6E4DD] rounded-2xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E6E4DD] pb-5">
          <div>
            <h2 className="text-2xl font-display font-bold tracking-tight text-[#14213D]">
              Master LO + LO Details — 8-Sheet Excel Workbook
            </h2>
            <p className="text-sm text-[#57534E] mt-1">
              Download the complete `.xlsx` workbook containing all 8 structured
              sheets populated with live personnel, hierarchy, and delegate
              records.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              exportMasterExcelWorkbook(
                officers,
                vaultMap,
                delegates,
                assignmentLogs,
                config
              )
            }
            className="inline-flex items-center gap-2 px-5 py-3 text-xs font-semibold text-white bg-[#1D4ED8] rounded-xl hover:bg-[#1E40AF] transition-colors whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Download 8-Sheet Excel Workbook (.xlsx)
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {workbookSheets.map((s) => (
            <div
              key={s.num}
              className="p-4 border border-[#E6E4DD] rounded-xl bg-[#F7F6F2]"
            >
              <div className="text-xs font-mono font-semibold text-[#B45309] tabular-nums">
                Sheet {s.num}
              </div>
              <div className="text-sm font-bold text-[#14213D] mt-1">
                {s.title}
              </div>
              <p className="text-xs text-[#57534E] mt-1.5 leading-relaxed">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Individual LO Profile PDFs */}
      <div className="bg-white border border-[#E6E4DD] rounded-2xl p-6 space-y-5">
        <div className="border-b border-[#E6E4DD] pb-4">
          <h3 className="text-lg font-display font-bold text-[#14213D]">
            Individual LO Profile Dossiers (PDF) & Credential Vault
          </h3>
          <p className="text-sm text-[#57534E] mt-0.5">
            Each individual LO PDF includes full name, designation, company,
            registration number, badge category, assigned Master LO, portrait,
            ID document, specimen signature, airport post, and assigned
            delegates.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {officers.map((o) => {
            const vault = vaultMap[o.id];
            return (
              <div
                key={o.id}
                className="p-4 border border-[#E6E4DD] rounded-xl flex items-center justify-between gap-4 hover:bg-[#F7F6F2] transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <OfficerPortraitSvg
                    fullName={o.fullName}
                    styleTone={vault?.photoStyle || 'navy'}
                    size="md"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-[#14213D] truncate">
                      {o.fullName}
                    </div>
                    <div className="text-xs text-[#57534E] font-mono tabular-nums truncate">
                      {o.designation} · ID {o.officerCode} · {o.approvalStatus}
                    </div>
                    <div className="text-xs text-[#78716C] truncate mt-0.5">
                      {vault?.idDocumentType || 'Protocol ID'} ·{' '}
                      {vault?.contactNumber || 'On File'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onSelectOfficerForVault(o)}
                    className="px-3 py-2 text-xs font-medium text-[#14213D] border border-[#D6D3CD] rounded-lg hover:bg-[#F7F6F2] transition-colors whitespace-nowrap shrink-0"
                  >
                    ID & Signature
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      exportIndividualLoPdf(o, vault, officers, delegates)
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#14213D] rounded-lg hover:bg-[#1E3A8A] transition-colors whitespace-nowrap shrink-0"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    Export PDF
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const LoFieldAppView: React.FC<LogisticsProps> = ({
  officers,
  delegates,
  currentUserId,
  onLocalDelegateUpdate,
}) => {
  const [selectedOfficerId, setSelectedOfficerId] = useState<string>(
    officers.find((o) => o.fullName === 'Rushi')?.id || officers[0]?.id || ''
  );
  const [viewportPreview, setViewportPreview] = useState<'desktop' | 'mobile'>(
    'desktop'
  );
  const [savedToast, setSavedToast] = useState<string | null>(null);

  const activeOfficer =
    officers.find((o) => o.id === selectedOfficerId) || officers[0];

  const myDelegates = delegates.filter((d) => {
    if (!activeOfficer) return true;
    if (activeOfficer.designation === 'Master LO') return true;
    return (
      d.loId === activeOfficer.id ||
      d.subLoId === activeOfficer.id ||
      d.masterLoId === activeOfficer.id
    );
  });

  const handleFieldStatusUpdate = async (
    del: DelegateRecord,
    pickupStatus: PickupStatus,
    dropoffStatus: DropoffStatus,
    registrationStatus: RegistrationStatus
  ) => {
    if (currentUserId) {
      try {
        await updateDoc(doc(db, 'delegates', del.id), {
          pickupStatus,
          dropoffStatus,
          registrationStatus,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(
          err,
          OperationType.UPDATE,
          `delegates/${del.id}`
        );
      }
    } else {
      onLocalDelegateUpdate(del.id, {
        pickupStatus,
        dropoffStatus,
        registrationStatus,
      });
    }
    setSavedToast(`Updated live status for ${del.delegateName}`);
    setTimeout(() => setSavedToast(null), 2500);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E6E4DD] pb-5">
        <div>
          <h2 className="text-2xl font-display font-bold tracking-tight text-[#14213D]">
            Field Officer Operations App
          </h2>
          <p className="text-sm text-[#57534E] mt-1">
            Select any Liaison Officer or Sub-LO to coordinate their assigned
            delegates, airport pickups, hotel rooms, and vehicles on Web or
            Mobile.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedOfficerId}
            onChange={(e) => setSelectedOfficerId(e.target.value)}
            className="px-3.5 py-2 text-xs font-semibold border border-[#D6D3CD] rounded-xl bg-white text-[#14213D] focus:outline-none focus:border-[#1D4ED8]"
          >
            {officers.map((o) => (
              <option key={o.id} value={o.id}>
                Officer on Duty: {o.fullName} ({o.designation} — ID{' '}
                {o.officerCode})
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1 p-1 bg-[#E6E4DD]/70 rounded-xl">
            <button
              type="button"
              onClick={() => setViewportPreview('desktop')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                viewportPreview === 'desktop'
                  ? 'bg-white text-[#14213D] shadow-xs'
                  : 'text-[#57534E] hover:text-[#1C1917]'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" /> Web View
            </button>
            <button
              type="button"
              onClick={() => setViewportPreview('mobile')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                viewportPreview === 'mobile'
                  ? 'bg-white text-[#14213D] shadow-xs'
                  : 'text-[#57534E] hover:text-[#1C1917]'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" /> Mobile Handset
            </button>
          </div>
        </div>
      </div>

      {savedToast && (
        <div className="px-4 py-3 bg-[#ECFDF5] border border-[#A7F3D0] rounded-xl text-xs font-semibold text-[#065F46] flex items-center gap-2">
          <Check className="w-4 h-4" />
          {savedToast}
        </div>
      )}

      <div
        className={
          viewportPreview === 'mobile'
            ? 'max-w-md mx-auto border-[3px] border-[#14213D] rounded-3xl p-4 bg-[#F7F6F2] shadow-sm space-y-4'
            : 'space-y-4'
        }
      >
        {activeOfficer && (
          <div className="p-5 bg-[#14213D] text-white rounded-2xl flex items-center justify-between gap-4">
            <div>
              <div className="text-xs text-amber-200/90 font-mono tabular-nums">
                {activeOfficer.designation} · ID {activeOfficer.officerCode} ·{' '}
                {activeOfficer.approvalStatus}
              </div>
              <div className="text-lg font-display font-bold mt-0.5">
                {activeOfficer.fullName} — Field Dispatch
              </div>
              <div className="text-xs text-slate-300 mt-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-300" />
                {activeOfficer.airportAssignment}
              </div>
            </div>
            <div className="text-right font-mono tabular-nums shrink-0">
              <div className="text-2xl font-bold">{myDelegates.length}</div>
              <div className="text-xs text-slate-300">Assigned VIPs</div>
            </div>
          </div>
        )}

        {myDelegates.length === 0 ? (
          <div className="p-8 bg-white border border-[#E6E4DD] rounded-2xl text-center text-sm text-[#57534E]">
            No delegates are currently assigned to {activeOfficer?.fullName}.
          </div>
        ) : (
          <div
            className={
              viewportPreview === 'mobile'
                ? 'space-y-4'
                : 'grid grid-cols-1 md:grid-cols-2 gap-5'
            }
          >
            {myDelegates.map((d) => (
              <div
                key={d.id}
                className="bg-white border border-[#E6E4DD] rounded-2xl p-5 space-y-4"
              >
                <div className="flex items-start justify-between gap-3 border-b border-[#E6E4DD] pb-3.5">
                  <div>
                    <div className="text-base font-bold text-[#14213D]">
                      {d.delegateName}
                    </div>
                    <div className="text-xs text-[#57534E] mt-0.5">
                      {d.company} ·{' '}
                      <span className="font-mono tabular-nums">
                        {d.registrationNumber}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-[#047857]">
                    {d.registrationStatus}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="text-[#57534E]">Arrival Flight:</span>
                    <span className="font-mono font-semibold text-[#1C1917] tabular-nums text-right">
                      {d.arrivalFlight} ({d.arrivalDateTime})
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[#57534E]">Departure Flight:</span>
                    <span className="font-mono font-semibold text-[#1C1917] tabular-nums text-right">
                      {d.departureFlight} ({d.departureDateTime})
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[#57534E]">Hotel & Suite:</span>
                    <span className="font-semibold text-[#1C1917] text-right">
                      {d.hotelName} — {d.roomDetails}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[#57534E]">Protocol Vehicle:</span>
                    <span className="font-mono font-semibold text-[#1C1917] tabular-nums text-right">
                      {d.vehicleNumber} ({d.driverName})
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[#57534E]">Chauffeur Direct:</span>
                    <span className="font-mono text-[#57534E] tabular-nums flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {d.driverContact}
                    </span>
                  </div>
                </div>

                <div className="pt-3.5 border-t border-[#E6E4DD] grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-medium text-[#57534E] mb-1">
                      Airport Pickup
                    </label>
                    <select
                      value={d.pickupStatus}
                      onChange={(e) =>
                        handleFieldStatusUpdate(
                          d,
                          e.target.value as PickupStatus,
                          d.dropoffStatus,
                          d.registrationStatus
                        )
                      }
                      className="w-full px-2.5 py-1.5 text-xs font-semibold border border-[#D6D3CD] rounded-lg bg-white text-[#1C1917]"
                    >
                      <option value="Scheduled">Scheduled</option>
                      <option value="En Route">En Route</option>
                      <option value="Picked Up">Picked Up</option>
                      <option value="Delayed">Delayed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#57534E] mb-1">
                      Airport Drop-off
                    </label>
                    <select
                      value={d.dropoffStatus}
                      onChange={(e) =>
                        handleFieldStatusUpdate(
                          d,
                          d.pickupStatus,
                          e.target.value as DropoffStatus,
                          d.registrationStatus
                        )
                      }
                      className="w-full px-2.5 py-1.5 text-xs font-semibold border border-[#D6D3CD] rounded-lg bg-white text-[#1C1917]"
                    >
                      <option value="Scheduled">Scheduled</option>
                      <option value="In Transit">In Transit</option>
                      <option value="Dropped Off">Dropped Off</option>
                      <option value="Pending">Pending</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#57534E] mb-1">
                      Overall Status
                    </label>
                    <select
                      value={d.registrationStatus}
                      onChange={(e) =>
                        handleFieldStatusUpdate(
                          d,
                          d.pickupStatus,
                          d.dropoffStatus,
                          e.target.value as RegistrationStatus
                        )
                      }
                      className="w-full px-2.5 py-1.5 text-xs font-semibold border border-[#D6D3CD] rounded-lg bg-white text-[#1C1917]"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Confirmed">Confirmed</option>
                      <option value="Completed">Completed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
