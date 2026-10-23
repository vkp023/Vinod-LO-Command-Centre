import {
  doc,
  setDoc,
  serverTimestamp,
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  Officer,
  OfficerVault,
  DelegateRecord,
  SystemConfig,
  AssignmentLog,
} from '../types';

export function buildDefaultDataset(uid: string): {
  config: SystemConfig;
  officers: Officer[];
  vaultMap: Record<string, OfficerVault>;
  assignmentLogs: AssignmentLog[];
  delegates: DelegateRecord[];
} {
  const prefix = uid.slice(0, 10) || 'demo';
  const masterId = `off_mlo_${prefix}_dayanand`;
  const rushiId = `off_lo_${prefix}_rushi`;
  const kaivanId = `off_lo_${prefix}_kaivan`;
  const mittalId = `off_lo_${prefix}_mittal`;

  const poojanId = `off_sub_${prefix}_001`;
  const ronnieId = `off_sub_${prefix}_002`;
  const vinodId = `off_sub_${prefix}_003`;
  const prateekhId = `off_sub_${prefix}_004`;

  const config: SystemConfig = {
    id: `cfg_${prefix}`,
    ownerId: uid,
    hierarchyRule: '1_to_5',
    deploymentMode: 'both',
    metricMeaning: 'live_counts',
    dayanandRole: 'Master LO',
    delegateTarget: 10,
    arrivalTarget: 2,
    departureTarget: 1,
  };

  const officers: Officer[] = [
    {
      id: masterId,
      ownerId: uid,
      officerCode: 'MLO-01',
      fullName: 'Vinod Kr. Pandey',
      designation: 'Master LO',
      companyName: 'Central Protocol Directorate',
      registrationNumber: 'REG-MLO-2026-01',
      badgeCategory: 'Badge Category LO - Command',
      assignedMasterLoId: '',
      assignedLoId: '',
      assignedSubLoId: '',
      approvalStatus: 'Approved',
      airportAssignment: 'CSMIA Terminal 2 — Central Protocol Command',
    },
    {
      id: rushiId,
      ownerId: uid,
      officerCode: 'LO-101',
      fullName: 'Rushi',
      designation: 'LO',
      companyName: 'Apex Summit Operations',
      registrationNumber: 'REG-LO-2026-101',
      badgeCategory: 'Badge Category LO - Gold',
      assignedMasterLoId: masterId,
      assignedLoId: '',
      assignedSubLoId: poojanId,
      approvalStatus: 'Approved',
      airportAssignment: 'Terminal 2 — International Arrivals Gate A',
    },
    {
      id: kaivanId,
      ownerId: uid,
      officerCode: 'LO-102',
      fullName: 'Kaivan',
      designation: 'LO',
      companyName: 'Apex Summit Operations',
      registrationNumber: 'REG-LO-2026-102',
      badgeCategory: 'Badge Category LO - Gold',
      assignedMasterLoId: masterId,
      assignedLoId: '',
      assignedSubLoId: vinodId,
      approvalStatus: 'Approved',
      airportAssignment: 'Terminal 2 — VIP Lounge & Concourse B',
    },
    {
      id: mittalId,
      ownerId: uid,
      officerCode: 'LO-103',
      fullName: 'Mittal',
      designation: 'LO',
      companyName: 'Horizon Event Logistics',
      registrationNumber: 'REG-LO-2026-103',
      badgeCategory: 'Badge Category LO - Gold',
      assignedMasterLoId: masterId,
      assignedLoId: '',
      assignedSubLoId: prateekhId,
      approvalStatus: 'Approved',
      airportAssignment: 'Terminal 1 — Domestic VVIP Bay',
    },
    {
      id: poojanId,
      ownerId: uid,
      officerCode: '001',
      fullName: 'Poojan',
      designation: 'Sub-LO',
      companyName: 'Apex Summit Operations',
      registrationNumber: 'REG-SLO-2026-001',
      badgeCategory: 'Badge Category LO - Operational',
      assignedMasterLoId: masterId,
      assignedLoId: rushiId,
      assignedSubLoId: '',
      approvalStatus: 'Approved',
      airportAssignment: 'Terminal 2 — Arrival Curbside Zone 1',
    },
    {
      id: ronnieId,
      ownerId: uid,
      officerCode: '002',
      fullName: 'Ronnie',
      designation: 'Sub-LO',
      companyName: 'Apex Summit Operations',
      registrationNumber: 'REG-SLO-2026-002',
      badgeCategory: 'Badge Category LO - Operational',
      assignedMasterLoId: masterId,
      assignedLoId: rushiId,
      assignedSubLoId: '',
      approvalStatus: 'Approved',
      airportAssignment: 'Terminal 2 — Baggage & Customs Escort',
    },
    {
      id: vinodId,
      ownerId: uid,
      officerCode: '003',
      fullName: 'Vinod',
      designation: 'Sub-LO',
      companyName: 'Apex Summit Operations',
      registrationNumber: 'REG-SLO-2026-003',
      badgeCategory: 'Badge Category LO - Operational',
      assignedMasterLoId: masterId,
      assignedLoId: kaivanId,
      assignedSubLoId: '',
      approvalStatus: 'Approved',
      airportAssignment: 'Terminal 2 — Fleet Dispatch Desk',
    },
    {
      id: prateekhId,
      ownerId: uid,
      officerCode: '004',
      fullName: 'Prateekh',
      designation: 'Sub-LO',
      companyName: 'Horizon Event Logistics',
      registrationNumber: 'REG-SLO-2026-004',
      badgeCategory: 'Badge Category LO - Operational',
      assignedMasterLoId: masterId,
      assignedLoId: mittalId,
      assignedSubLoId: '',
      approvalStatus: 'Pending',
      airportAssignment: 'Terminal 1 — Hotel Transfer Desk',
    },
  ];

  const vaultMap: Record<string, OfficerVault> = {
    [masterId]: {
      id: 'primary',
      ownerId: uid,
      officerId: masterId,
      contactNumber: '+91 98201 11001',
      idDocumentType: 'Diplomatic Protocol Pass',
      idDocumentNumber: 'DPP-IND-884920',
      signatureText: 'Vinod Kr. Pandey',
      photoStyle: 'charcoal',
      verifiedByStaff: true,
    },
    [rushiId]: {
      id: 'primary',
      ownerId: uid,
      officerId: rushiId,
      contactNumber: '+91 98201 22101',
      idDocumentType: 'National Aviation Security ID',
      idDocumentNumber: 'AEP-T2-44109',
      signatureText: 'Rushi Patel',
      photoStyle: 'navy',
      verifiedByStaff: true,
    },
    [kaivanId]: {
      id: 'primary',
      ownerId: uid,
      officerId: kaivanId,
      contactNumber: '+91 98201 22102',
      idDocumentType: 'National Aviation Security ID',
      idDocumentNumber: 'AEP-T2-44110',
      signatureText: 'Kaivan Shah',
      photoStyle: 'slate',
      verifiedByStaff: true,
    },
    [mittalId]: {
      id: 'primary',
      ownerId: uid,
      officerId: mittalId,
      contactNumber: '+91 98201 22103',
      idDocumentType: 'National Aviation Security ID',
      idDocumentNumber: 'AEP-T1-44111',
      signatureText: 'Mittal Desai',
      photoStyle: 'emerald',
      verifiedByStaff: true,
    },
    [poojanId]: {
      id: 'primary',
      ownerId: uid,
      officerId: poojanId,
      contactNumber: '+91 98201 33001',
      idDocumentType: 'Government Photo ID',
      idDocumentNumber: 'GID-2026-9001',
      signatureText: 'Poojan M.',
      photoStyle: 'indigo',
      verifiedByStaff: true,
    },
    [ronnieId]: {
      id: 'primary',
      ownerId: uid,
      officerId: ronnieId,
      contactNumber: '+91 98201 33002',
      idDocumentType: 'Government Photo ID',
      idDocumentNumber: 'GID-2026-9002',
      signatureText: 'Ronnie D.',
      photoStyle: 'slate',
      verifiedByStaff: true,
    },
    [vinodId]: {
      id: 'primary',
      ownerId: uid,
      officerId: vinodId,
      contactNumber: '+91 98201 33003',
      idDocumentType: 'Government Photo ID',
      idDocumentNumber: 'GID-2026-9003',
      signatureText: 'Vinod K.',
      photoStyle: 'navy',
      verifiedByStaff: true,
    },
    [prateekhId]: {
      id: 'primary',
      ownerId: uid,
      officerId: prateekhId,
      contactNumber: '+91 98201 33004',
      idDocumentType: 'Government Photo ID',
      idDocumentNumber: 'GID-2026-9004',
      signatureText: 'Prateekh V.',
      photoStyle: 'charcoal',
      verifiedByStaff: false,
    },
  };

  const assignmentLogs: AssignmentLog[] = [
    {
      id: `log_${prefix}_1`,
      ownerId: uid,
      subLoId: poojanId,
      subLoName: 'Poojan',
      subLoCode: '001',
      previousLoName: 'Unassigned',
      newLoId: rushiId,
      newLoName: 'Rushi',
      hierarchyRuleApplied: '1_to_5',
    },
    {
      id: `log_${prefix}_2`,
      ownerId: uid,
      subLoId: ronnieId,
      subLoName: 'Ronnie',
      subLoCode: '002',
      previousLoName: 'Unassigned',
      newLoId: rushiId,
      newLoName: 'Rushi',
      hierarchyRuleApplied: '1_to_5',
    },
    {
      id: `log_${prefix}_3`,
      ownerId: uid,
      subLoId: vinodId,
      subLoName: 'Vinod',
      subLoCode: '003',
      previousLoName: 'Unassigned',
      newLoId: kaivanId,
      newLoName: 'Kaivan',
      hierarchyRuleApplied: '1_to_5',
    },
    {
      id: `log_${prefix}_4`,
      ownerId: uid,
      subLoId: prateekhId,
      subLoName: 'Prateekh',
      subLoCode: '004',
      previousLoName: 'Unassigned',
      newLoId: mittalId,
      newLoName: 'Mittal',
      hierarchyRuleApplied: '1_to_5',
    },
  ];

  const delegates: DelegateRecord[] = [
    {
      id: `del_${prefix}_1`,
      ownerId: uid,
      delegateName: 'Dr. Arvind Singhania',
      registrationNumber: 'DEL-2026-801',
      company: 'Global Sovereign Fund',
      badgeCategory: 'VVIP Head of Delegation',
      contactNumber: '+91 98111 40011',
      masterLoId: masterId,
      loId: rushiId,
      subLoId: poojanId,
      assignedHandler: 'Poojan (Sub-LO 001)',
      arrivalAirport: 'CSMIA Terminal 2',
      arrivalFlight: 'AI-102 (New York -> BOM)',
      arrivalDateTime: '2026-10-23 08:30',
      pickupStatus: 'Picked Up',
      departureAirport: 'CSMIA Terminal 2',
      departureFlight: 'AI-101 (BOM -> JFK)',
      departureDateTime: '2026-10-25 23:45',
      dropoffStatus: 'Scheduled',
      hotelName: 'The Taj Mahal Palace',
      hotelAddress: 'Apollo Bunder, Colaba, Mumbai 400001',
      checkInDateTime: '2026-10-23 10:00',
      checkOutDateTime: '2026-10-25 20:00',
      roomDetails: 'Presidential Suite 1402 — Tower Wing',
      vehicleNumber: 'MH-01-DB-0001',
      vehicleType: 'Mercedes-Benz S-Class (Armoured Protocol)',
      driverName: 'Rajesh Chavan',
      driverContact: '+91 98204 77101',
      pickupSchedule: '08:15 Gate A4 VIP Tarmac',
      registrationStatus: 'Confirmed',
    },
    {
      id: `del_${prefix}_2`,
      ownerId: uid,
      delegateName: 'Elena Rostova',
      registrationNumber: 'DEL-2026-802',
      company: 'EuroTech Semiconductor Consortium',
      badgeCategory: 'Executive Delegate',
      contactNumber: '+41 79 442 1900',
      masterLoId: masterId,
      loId: rushiId,
      subLoId: ronnieId,
      assignedHandler: 'Ronnie (Sub-LO 002)',
      arrivalAirport: 'CSMIA Terminal 2',
      arrivalFlight: 'LH-756 (Frankfurt -> BOM)',
      arrivalDateTime: '2026-10-23 11:15',
      pickupStatus: 'En Route',
      departureAirport: 'CSMIA Terminal 2',
      departureFlight: 'LH-757 (BOM -> FRA)',
      departureDateTime: '2026-10-26 02:10',
      dropoffStatus: 'Pending',
      hotelName: 'The Oberoi Mumbai',
      hotelAddress: 'Nariman Point, Mumbai 400021',
      checkInDateTime: '2026-10-23 12:30',
      checkOutDateTime: '2026-10-25 22:30',
      roomDetails: 'Premier Ocean View Room 912',
      vehicleNumber: 'MH-01-DB-0004',
      vehicleType: 'BMW 7 Series Executive Sedan',
      driverName: 'Suresh Nair',
      driverContact: '+91 98204 77104',
      pickupSchedule: '11:00 Terminal 2 Gate B2',
      registrationStatus: 'Confirmed',
    },
    {
      id: `del_${prefix}_3`,
      ownerId: uid,
      delegateName: 'Kenji Takahashi',
      registrationNumber: 'DEL-2026-803',
      company: 'Pacific Clean Energy Holdings',
      badgeCategory: 'Ministerial Envoy',
      contactNumber: '+81 90 3312 8840',
      masterLoId: masterId,
      loId: kaivanId,
      subLoId: vinodId,
      assignedHandler: 'Vinod (Sub-LO 003)',
      arrivalAirport: 'CSMIA Terminal 2',
      arrivalFlight: 'NH-829 (Tokyo -> BOM)',
      arrivalDateTime: '2026-10-22 19:40',
      pickupStatus: 'Scheduled',
      departureAirport: 'CSMIA Terminal 2',
      departureFlight: 'NH-830 (BOM -> NRT)',
      departureDateTime: '2026-10-23 16:20',
      dropoffStatus: 'In Transit',
      hotelName: 'Trident Nariman Point',
      hotelAddress: 'Netaji Subhash Chandra Bose Road, Mumbai 400021',
      checkInDateTime: '2026-10-22 21:00',
      checkOutDateTime: '2026-10-23 13:00',
      roomDetails: 'Trident Club Suite 1808',
      vehicleNumber: 'MH-01-DB-0009',
      vehicleType: 'Toyota Vellfire Executive Lounge',
      driverName: 'Mahesh Shinde',
      driverContact: '+91 98204 77109',
      pickupSchedule: '13:15 Hotel Lobby -> Terminal 2 Departure Gate 3',
      registrationStatus: 'Confirmed',
    },
  ];

  return { config, officers, vaultMap, assignmentLogs, delegates };
}

export async function ensureSeededData(uid: string): Promise<void> {
  const officersRef = collection(db, 'officers');
  let existingCount = 0;
  try {
    const q = query(officersRef, where('ownerId', '==', uid));
    const snap = await getDocs(q);
    existingCount = snap.size;
    for (const docSnap of snap.docs) {
      const data = docSnap.data() as Officer;
      if (data.designation === 'Master LO' && data.fullName === 'Dayanand') {
        await setDoc(
          doc(db, 'officers', docSnap.id),
          { fullName: 'Vinod Kr. Pandey', updatedAt: serverTimestamp() },
          { merge: true }
        );
        await setDoc(
          doc(db, 'officers', docSnap.id, 'vault', 'primary'),
          { signatureText: 'Vinod Kr. Pandey', updatedAt: serverTimestamp() },
          { merge: true }
        );
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'officers');
  }

  if (existingCount > 0) {
    return;
  }

  const defaults = buildDefaultDataset(uid);

  const { id: configId, ...configData } = defaults.config;
  try {
    await setDoc(doc(db, 'configs', configId), {
      ...configData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `configs/${configId}`);
  }

  for (const off of defaults.officers) {
    const { id: offId, ...offData } = off;
    const vault = defaults.vaultMap[offId];
    const { id: _vId, ...vaultData } = vault;
    try {
      await setDoc(doc(db, 'officers', offId), {
        ...offData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await setDoc(doc(db, 'officers', offId, 'vault', 'primary'), {
        ...vaultData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `officers/${offId}`);
    }
  }

  for (const log of defaults.assignmentLogs) {
    const { id: logId, ...logData } = log;
    try {
      await setDoc(doc(db, 'assignmentLogs', logId), {
        ...logData,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.CREATE,
        `assignmentLogs/${logId}`
      );
    }
  }

  for (const del of defaults.delegates) {
    const { id: delId, ...delData } = del;
    try {
      await setDoc(doc(db, 'delegates', delId), {
        ...delData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `delegates/${delId}`);
    }
  }
}
