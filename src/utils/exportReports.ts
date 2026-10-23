import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Officer,
  OfficerVault,
  DelegateRecord,
  AssignmentLog,
  SystemConfig,
} from '../types';

export function exportMasterExcelWorkbook(
  officers: Officer[],
  vaultMap: Record<string, OfficerVault>,
  delegates: DelegateRecord[],
  assignmentLogs: AssignmentLog[],
  config: SystemConfig | null
): void {
  const wb = XLSX.utils.book_new();

  const officerById = new Map<string, Officer>();
  officers.forEach((o) => officerById.set(o.id, o));

  const masterLos = officers.filter((o) => o.designation === 'Master LO');
  const los = officers.filter((o) => o.designation === 'LO');
  const subLos = officers.filter((o) => o.designation === 'Sub-LO');

  // Sheet 1: Master LO Overview
  const overviewRows = [
    {
      Metric: 'Total Personnel (All Roles)',
      Count: officers.length,
      Details: `${masterLos.length} Master LO · ${los.length} LOs · ${subLos.length} Sub-LOs`,
    },
    {
      Metric: 'Approved Officers',
      Count: officers.filter((o) => o.approvalStatus === 'Approved').length,
      Details: 'Cleared for active operational assignment',
    },
    {
      Metric: 'Pending Approvals',
      Count: officers.filter((o) => o.approvalStatus === 'Pending').length,
      Details: 'Awaiting administrator decision',
    },
    {
      Metric: 'Disapproved Officers',
      Count: officers.filter((o) => o.approvalStatus === 'Disapproved').length,
      Details: 'Restricted from operational assignment',
    },
    {
      Metric: 'Active Reporting Hierarchy Rule',
      Count:
        config?.hierarchyRule === '1_to_1'
          ? 1
          : config?.hierarchyRule === '1_to_5'
          ? 5
          : 999,
      Details:
        config?.hierarchyRule === '1_to_1'
          ? '1 LO -> 1 Sub-LO (One Sub-LO per LO)'
          : config?.hierarchyRule === '1_to_5'
          ? '1 LO -> 5 Sub-LOs (Maximum five Sub-LOs per LO)'
          : '1 LO -> Unlimited Sub-LOs',
    },
    {
      Metric: 'Registered Delegates',
      Count: delegates.length,
      Details: `Configured Target / Allocation: ${config?.delegateTarget ?? 10}`,
    },
    {
      Metric: 'Active Airport Arrivals (Picked Up / En Route)',
      Count: delegates.filter(
        (d) => d.pickupStatus === 'Picked Up' || d.pickupStatus === 'En Route'
      ).length,
      Details: `Configured Target / Count: ${config?.arrivalTarget ?? 2}`,
    },
    {
      Metric: 'Active Airport Departures (In Transit / Dropped Off)',
      Count: delegates.filter(
        (d) => d.dropoffStatus === 'In Transit' || d.dropoffStatus === 'Dropped Off'
      ).length,
      Details: `Configured Target / Count: ${config?.departureTarget ?? 1}`,
    },
  ];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(overviewRows),
    '1. Master LO Overview'
  );

  // Sheet 2: LO Details
  const loRows = officers
    .filter((o) => o.designation === 'Master LO' || o.designation === 'LO')
    .map((o) => {
      const vault = vaultMap[o.id];
      const masterName = o.assignedMasterLoId
        ? officerById.get(o.assignedMasterLoId)?.fullName || 'Vinod Kr. Pandey'
        : o.designation === 'Master LO'
        ? 'Self (Master LO)'
        : 'Unassigned';
      const teamSize = subLos.filter((s) => s.assignedLoId === o.id).length;
      return {
        'Officer Code': o.officerCode,
        'Full Name': o.fullName,
        Designation: o.designation,
        'Company Name': o.companyName,
        'Registration Number': o.registrationNumber,
        'Badge Category': o.badgeCategory,
        'Assigned Master LO': masterName,
        'Sub-LO Team Count': teamSize,
        'Approval Status': o.approvalStatus,
        'Airport Assignment': o.airportAssignment,
        'Contact Number': vault?.contactNumber || 'Restricted',
        'ID Document': vault ? `${vault.idDocumentType} (${vault.idDocumentNumber})` : 'On File',
      };
    });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(loRows), '2. LO Details');

  // Sheet 3: Sub-LO Details
  const subLoRows = subLos.map((s) => {
    const vault = vaultMap[s.id];
    const assignedLo = s.assignedLoId
      ? officerById.get(s.assignedLoId)?.fullName || 'Unassigned'
      : 'Unassigned';
    return {
      'Sub-LO ID': s.officerCode,
      Name: s.fullName,
      Designation: s.designation,
      'Assigned LO': assignedLo,
      'Approval Status': s.approvalStatus,
      'Company Name': s.companyName,
      'Registration Number': s.registrationNumber,
      'Badge Category': s.badgeCategory,
      'Airport Assignment': s.airportAssignment,
      'Contact Number': vault?.contactNumber || 'Restricted',
    };
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(subLoRows), '3. Sub-LO Details');

  // Sheet 4: LO-Sub-LO Assignments
  const assignmentRows = subLos.map((s) => {
    const lo = s.assignedLoId ? officerById.get(s.assignedLoId) : undefined;
    const master = s.assignedMasterLoId
      ? officerById.get(s.assignedMasterLoId)
      : masterLos[0];
    return {
      'Sub-LO': s.fullName,
      'Sub-LO ID': s.officerCode,
      'Sub-LO Approval': s.approvalStatus,
      'Assigned LO': lo?.fullName || 'Unassigned',
      'LO Code': lo?.officerCode || '—',
      'Master LO': master?.fullName || 'Vinod Kr. Pandey',
      'Airport Sector': s.airportAssignment,
    };
  });
  if (assignmentLogs.length > 0) {
    assignmentLogs.forEach((log) => {
      assignmentRows.push({
        'Sub-LO': `[History] ${log.subLoName}`,
        'Sub-LO ID': log.subLoCode,
        'Sub-LO Approval': 'Logged Change',
        'Assigned LO': `${log.previousLoName} -> ${log.newLoName}`,
        'LO Code': log.hierarchyRuleApplied,
        'Master LO': 'Audit Trail',
        'Airport Sector': 'Reassignment Record',
      });
    });
  }
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(assignmentRows),
    '4. LO-Sub-LO Assignments'
  );

  // Sheet 5: Delegate Registration
  const delegateRows = delegates.map((d) => ({
    'Delegate Name': d.delegateName,
    'Registration Number': d.registrationNumber,
    Company: d.company,
    'Badge Category': d.badgeCategory,
    'Contact Number': d.contactNumber,
    'Master LO': officerById.get(d.masterLoId)?.fullName || 'Vinod Kr. Pandey',
    'Assigned LO': officerById.get(d.loId)?.fullName || '—',
    'Assigned Sub-LO': officerById.get(d.subLoId)?.fullName || '—',
    'Assigned Handler': d.assignedHandler,
    'Registration Status': d.registrationStatus,
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(delegateRows),
    '5. Delegate Registration'
  );

  // Sheet 6: Airport Arrivals & Departures
  const airportRows = delegates.map((d) => ({
    Delegate: d.delegateName,
    'Registration No': d.registrationNumber,
    'Assigned Handler': d.assignedHandler,
    'Arrival Airport': d.arrivalAirport,
    'Arrival Flight': d.arrivalFlight,
    'Arrival Date & Time': d.arrivalDateTime,
    'Pickup Status': d.pickupStatus,
    'Departure Airport': d.departureAirport,
    'Departure Flight': d.departureFlight,
    'Departure Date & Time': d.departureDateTime,
    'Drop-off Status': d.dropoffStatus,
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(airportRows),
    '6. Airport Arrivals Departures'
  );

  // Sheet 7: Hotel & Car Details
  const hotelCarRows = delegates.map((d) => ({
    Delegate: d.delegateName,
    'Hotel Name': d.hotelName,
    'Hotel Address': d.hotelAddress,
    'Check-In': d.checkInDateTime,
    'Check-Out': d.checkOutDateTime,
    'Room Details': d.roomDetails,
    'Vehicle Number': d.vehicleNumber,
    'Vehicle Type': d.vehicleType,
    'Driver Name': d.driverName,
    'Driver Contact': d.driverContact,
    'Pickup Schedule': d.pickupSchedule,
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(hotelCarRows),
    '7. Hotel & Car Details'
  );

  // Sheet 8: Approval Status
  const approvalRows = officers.map((o) => ({
    'Officer Code / ID': o.officerCode,
    Name: o.fullName,
    Designation: o.designation,
    Company: o.companyName,
    'Registration No': o.registrationNumber,
    'Approval Status': o.approvalStatus,
    'Operational Eligibility':
      o.approvalStatus === 'Approved'
        ? 'Eligible for Active Assignment'
        : 'Blocked — Requires Approval',
    'Credential Vault Verified': vaultMap[o.id]?.verifiedByStaff ? 'Verified' : 'Pending Review',
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(approvalRows),
    '8. Approval Status'
  );

  XLSX.writeFile(wb, `LO_Command_Centre_Master_Workbook_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportIndividualLoPdf(
  officer: Officer,
  vault: OfficerVault | undefined,
  allOfficers: Officer[],
  delegates: DelegateRecord[]
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const masterLo = officer.assignedMasterLoId
    ? allOfficers.find((o) => o.id === officer.assignedMasterLoId)?.fullName || 'Vinod Kr. Pandey'
    : officer.designation === 'Master LO'
    ? `${officer.fullName} (Self — Master LO)`
    : 'Vinod Kr. Pandey';

  const assignedLo = officer.assignedLoId
    ? allOfficers.find((o) => o.id === officer.assignedLoId)?.fullName || '—'
    : '—';

  const teamSubLos = allOfficers.filter((o) => o.assignedLoId === officer.id);
  const assignedDelegates = delegates.filter(
    (d) =>
      d.masterLoId === officer.id ||
      d.loId === officer.id ||
      d.subLoId === officer.id
  );

  // Header Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 36, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('LIAISON OFFICER (LO) COMMAND CENTRE', 14, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(203, 213, 225);
  doc.text(
    `OFFICIAL PERSONNEL DOSSIER & CREDENTIAL RECORD  |  ID: ${officer.officerCode}`,
    14,
    23
  );
  doc.text(
    `Approval Status: ${officer.approvalStatus.toUpperCase()}  |  Badge: ${officer.badgeCategory}`,
    14,
    30
  );

  // Profile Photograph Box (Vector Portrait Representation)
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 44, 42, 48, 2, 2, 'FD');

  doc.setFillColor(30, 41, 59);
  doc.circle(35, 60, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  const initials = officer.fullName
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  doc.text(initials, 35, 62, { align: 'center' });

  doc.setTextColor(71, 85, 105);
  doc.setFontSize(7.5);
  doc.text('PROFILE PHOTOGRAPH', 35, 79, { align: 'center' });
  doc.text('Verified Biometric File', 35, 84, { align: 'center' });

  // Officer Core Identity Table
  autoTable(doc, {
    startY: 44,
    margin: { left: 62, right: 14 },
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 2.5,
      textColor: [15, 23, 42],
      lineColor: [226, 232, 240],
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
    },
    head: [['Attribute', 'Official Record']],
    body: [
      ['Full Name & Designation', `${officer.fullName} — ${officer.designation}`],
      ['Officer Code / Sub-LO ID', officer.officerCode],
      ['Company & Registration No.', `${officer.companyName} (${officer.registrationNumber})`],
      ['Badge Category', officer.badgeCategory],
      ['Assigned Master LO', masterLo],
      [
        'Reporting Relationship',
        officer.designation === 'Sub-LO'
          ? `Reports to LO: ${assignedLo}`
          : officer.designation === 'LO'
          ? `Supervises ${teamSubLos.length} Sub-LO(s)`
          : `Central Command Oversight`,
      ],
      ['Airport Assignment', officer.airportAssignment],
      ['Direct Contact Number', vault?.contactNumber || '+91 98201 00000'],
    ],
  });

  const afterIdentityY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // Secure Vault: ID Document & Signature Verification Box
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Authorized Credential Vault (ID Document & Signature)', 14, afterIdentityY);

  autoTable(doc, {
    startY: afterIdentityY + 3,
    margin: { left: 14, right: 14 },
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 3,
      textColor: [15, 23, 42],
      lineColor: [226, 232, 240],
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
    },
    head: [['ID Document Type', 'Document Reference No.', 'Authorized Specimen Signature', 'Security Clearance']],
    body: [
      [
        vault?.idDocumentType || 'Government Protocol ID',
        vault?.idDocumentNumber || `ID-${officer.registrationNumber}`,
        vault?.signatureText || `${officer.fullName} [Signed]`,
        vault?.verifiedByStaff ? 'VERIFIED — AUTHORIZED STAFF ONLY' : 'PENDING STAFF VERIFICATION',
      ],
    ],
  });

  const afterVaultY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // Assigned Sub-LOs (if Master LO or LO)
  let nextY = afterVaultY;
  if (teamSubLos.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(`Assigned Sub-LO Team (${teamSubLos.length})`, 14, nextY);

    autoTable(doc, {
      startY: nextY + 3,
      margin: { left: 14, right: 14 },
      theme: 'striped',
      styles: { fontSize: 8.5, cellPadding: 2.5 },
      headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255] },
      head: [['Sub-LO ID', 'Name', 'Approval Status', 'Registration No.', 'Airport Sector']],
      body: teamSubLos.map((s) => [
        s.officerCode,
        s.fullName,
        s.approvalStatus,
        s.registrationNumber,
        s.airportAssignment,
      ]),
    });
    nextY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // Assigned Delegates
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`Assigned Delegates & Logistics (${assignedDelegates.length})`, 14, nextY);

  if (assignedDelegates.length > 0) {
    autoTable(doc, {
      startY: nextY + 3,
      margin: { left: 14, right: 14 },
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
      head: [
        [
          'Delegate Name',
          'Reg. No.',
          'Arrival Flight & Status',
          'Departure Flight & Status',
          'Hotel & Room',
          'Assigned Vehicle',
        ],
      ],
      body: assignedDelegates.map((d) => [
        `${d.delegateName}\n(${d.company})`,
        d.registrationNumber,
        `${d.arrivalFlight}\n${d.arrivalDateTime} [${d.pickupStatus}]`,
        `${d.departureFlight}\n${d.departureDateTime} [${d.dropoffStatus}]`,
        `${d.hotelName}\n${d.roomDetails}`,
        `${d.vehicleNumber}\n${d.driverName}`,
      ]),
    });
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('No delegates currently assigned to this officer.', 14, nextY + 7);
  }

  // Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'CONFIDENTIAL — Personal photographs, ID documents and signatures are stored in the isolated Officer Vault with access restricted to authorized staff.',
    14,
    287
  );

  doc.save(`LO_Profile_${officer.officerCode}_${officer.fullName.replace(/\s+/g, '_')}.pdf`);
}
