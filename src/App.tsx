/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  addDoc,
  query,
  where,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  Shield,
  Users,
  UserCheck,
  Plane,
  Building2,
  FileSpreadsheet,
  FileText,
  Smartphone,
  Settings,
  UserPlus,
  CheckCircle2,
  Clock,
  Search,
  Download,
  Lock,
  ArrowRight,
  LogOut,
  AlertTriangle,
  History,
  Sparkles,
  Cloud,
  RefreshCw,
  Compass,
} from 'lucide-react';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from './firebase';
import {
  Officer,
  OfficerVault,
  AssignmentLog,
  SystemConfig,
  DelegateRecord,
  HierarchyRule,
  Designation,
  ApprovalStatus,
  NavigationTab,
} from './types';
import { ensureSeededData, buildDefaultDataset } from './utils/seedData';
import {
  exportMasterExcelWorkbook,
  exportIndividualLoPdf,
} from './utils/exportReports';
import { OfficerVaultModal, OfficerPortraitSvg } from './components/OfficerVaultModal';
import {
  DelegateManagementView,
  AirportTransportView,
  HotelManagementView,
  DocumentsReportsView,
  LoFieldAppView,
} from './components/LogisticsViews';

const DEMO_UID = 'local_sandbox_admin';
const INITIAL_DATA = buildDefaultDataset(DEMO_UID);

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<NavigationTab>('overview');

  // Operational state (initialized with rich default dataset for instant zero-friction interaction)
  const [config, setConfig] = useState<SystemConfig>(INITIAL_DATA.config);
  const [officers, setOfficers] = useState<Officer[]>(INITIAL_DATA.officers);
  const [vaultMap, setVaultMap] = useState<Record<string, OfficerVault>>(INITIAL_DATA.vaultMap);
  const [assignmentLogs, setAssignmentLogs] = useState<AssignmentLog[]>(INITIAL_DATA.assignmentLogs);
  const [delegates, setDelegates] = useState<DelegateRecord[]>(INITIAL_DATA.delegates);

  // Filters & UI state
  const [loSearch, setLoSearch] = useState('');
  const [designationFilter, setDesignationFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [vaultOfficer, setVaultOfficer] = useState<Officer | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Registration Form State
  const [regForm, setRegForm] = useState({
    fullName: '',
    designation: 'Sub-LO' as Designation,
    officerCode: '',
    companyName: 'Apex Summit Operations',
    registrationNumber: '',
    badgeCategory: 'Badge Category LO - Silver',
    assignedMasterLoId: INITIAL_DATA.officers[0]?.id || '',
    assignedLoId: INITIAL_DATA.officers[1]?.id || '',
    approvalStatus: 'Pending' as ApprovalStatus,
    airportAssignment: 'Terminal 2 — International Arrivals Gate A',
    contactNumber: '+91 98201 55000',
  });

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          await ensureSeededData(currentUser.uid);
        } catch (err) {
          console.error('Seed error:', err);
        }
      }
    });
    return () => unsub();
  }, []);

  // Firestore listeners when signed in
  useEffect(() => {
    if (!user) return;
    const uid = user.uid;

    const unsubConfig = onSnapshot(
      query(collection(db, 'configs'), where('ownerId', '==', uid)),
      (snap) => {
        if (!snap.empty) {
          const docSnap = snap.docs[0];
          setConfig({ ...(docSnap.data() as SystemConfig), id: docSnap.id });
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'configs')
    );

    const unsubOfficers = onSnapshot(
      query(collection(db, 'officers'), where('ownerId', '==', uid)),
      async (snap) => {
        if (!snap.empty) {
          const list = snap.docs.map((d) => ({ ...(d.data() as Officer), id: d.id }));
          list.sort((a, b) => a.officerCode.localeCompare(b.officerCode));
          setOfficers(list);

          const nextVaults: Record<string, OfficerVault> = {};
          for (const off of list) {
            try {
              const vSnap = await getDoc(doc(db, 'officers', off.id, 'vault', 'primary'));
              if (vSnap.exists()) {
                nextVaults[off.id] = { ...(vSnap.data() as OfficerVault), id: 'primary' };
              }
            } catch {
              // ignore individual vault fetch errors
            }
          }
          if (Object.keys(nextVaults).length > 0) {
            setVaultMap((prev) => ({ ...prev, ...nextVaults }));
          }
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'officers')
    );

    const unsubLogs = onSnapshot(
      query(collection(db, 'assignmentLogs'), where('ownerId', '==', uid)),
      (snap) => {
        if (!snap.empty) {
          const list = snap.docs.map((d) => ({ ...(d.data() as AssignmentLog), id: d.id }));
          setAssignmentLogs(list);
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'assignmentLogs')
    );

    const unsubDelegates = onSnapshot(
      query(collection(db, 'delegates'), where('ownerId', '==', uid)),
      (snap) => {
        if (!snap.empty) {
          const list = snap.docs.map((d) => ({ ...(d.data() as DelegateRecord), id: d.id }));
          setDelegates(list);
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'delegates')
    );

    return () => {
      unsubConfig();
      unsubOfficers();
      unsubLogs();
      unsubDelegates();
    };
  }, [user]);

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      showToast('Connected to Cloud Firestore live database');
    } catch (err: any) {
      setAuthError(err?.message || 'Sign-in cancelled or failed.');
    }
  };

  const handleResetDemoData = () => {
    const fresh = buildDefaultDataset(user?.uid || DEMO_UID);
    setConfig(fresh.config);
    setOfficers(fresh.officers);
    setVaultMap(fresh.vaultMap);
    setDelegates(fresh.delegates);
    setAssignmentLogs(fresh.assignmentLogs);
    showToast('Restored default operational roster');
  };

  // Derived collections
  const officerById = useMemo(() => {
    const map = new Map<string, Officer>();
    officers.forEach((o) => map.set(o.id, o));
    return map;
  }, [officers]);

  const masterLo = useMemo(
    () => officers.find((o) => o.designation === 'Master LO') || null,
    [officers]
  );
  const loList = useMemo(
    () => officers.filter((o) => o.designation === 'LO'),
    [officers]
  );
  const subLoList = useMemo(
    () =>
      officers
        .filter((o) => o.designation === 'Sub-LO')
        .sort((a, b) => a.officerCode.localeCompare(b.officerCode)),
    [officers]
  );

  const getMaxSubLoLimit = (rule: HierarchyRule): number => {
    if (rule === '1_to_1') return 1;
    if (rule === '1_to_5') return 5;
    return 9999;
  };

  const getSubLosForLo = (loId: string) =>
    subLoList.filter((s) => s.assignedLoId === loId);

  const getLoName = (loId: string) =>
    loId ? officerById.get(loId)?.fullName || 'Unassigned' : 'Unassigned';

  // Actions
  const handleUpdateApproval = async (officer: Officer, newStatus: ApprovalStatus) => {
    const nextLoId =
      newStatus !== 'Approved' && officer.designation === 'Sub-LO'
        ? ''
        : officer.assignedLoId;

    setOfficers((prev) =>
      prev.map((o) =>
        o.id === officer.id
          ? { ...o, approvalStatus: newStatus, assignedLoId: nextLoId }
          : o
      )
    );
    showToast(`${officer.fullName} status updated to ${newStatus}`);

    if (user) {
      try {
        await updateDoc(doc(db, 'officers', officer.id), {
          approvalStatus: newStatus,
          assignedLoId: nextLoId,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `officers/${officer.id}`);
      }
    }
  };

  const handleAssignSubLoToLo = async (subLo: Officer, targetLoId: string) => {
    if (subLo.approvalStatus !== 'Approved') {
      showToast(
        `Cannot assign ${subLo.fullName}: Sub-LO must be Approved before operational assignment.`,
        'error'
      );
      return;
    }

    if (!targetLoId) {
      setOfficers((prev) =>
        prev.map((o) => (o.id === subLo.id ? { ...o, assignedLoId: '' } : o))
      );
      showToast(`${subLo.fullName} unassigned.`);
      if (user) {
        try {
          await updateDoc(doc(db, 'officers', subLo.id), {
            assignedLoId: '',
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `officers/${subLo.id}`);
        }
      }
      return;
    }

    const targetLo = loList.find((l) => l.id === targetLoId);
    if (!targetLo) return;

    const currentAssigned = getSubLosForLo(targetLoId).filter((s) => s.id !== subLo.id);
    const maxLimit = getMaxSubLoLimit(config.hierarchyRule);

    if (currentAssigned.length >= maxLimit) {
      showToast(
        `Hierarchy Rule Violation (${config.hierarchyRule}): LO ${targetLo.fullName} already has ${currentAssigned.length}/${maxLimit} Sub-LO(s) assigned.`,
        'error'
      );
      return;
    }

    const prevLoName = getLoName(subLo.assignedLoId);
    const ruleLabel =
      config.hierarchyRule === '1_to_1'
        ? '1 LO -> 1 Sub-LO'
        : config.hierarchyRule === '1_to_5'
        ? '1 LO -> 5 Sub-LOs'
        : '1 LO -> Unlimited Sub-LOs';

    const newLog: AssignmentLog = {
      id: `log_${Date.now()}`,
      ownerId: user?.uid || DEMO_UID,
      subLoId: subLo.id,
      subLoName: subLo.fullName,
      subLoCode: subLo.officerCode,
      previousLoName: prevLoName,
      newLoId: targetLo.id,
      newLoName: targetLo.fullName,
      hierarchyRuleApplied: ruleLabel,
    };

    setOfficers((prev) =>
      prev.map((o) => (o.id === subLo.id ? { ...o, assignedLoId: targetLo.id } : o))
    );
    setAssignmentLogs((prev) => [newLog, ...prev]);
    showToast(`Assigned Sub-LO ${subLo.fullName} (#${subLo.officerCode}) to LO ${targetLo.fullName}`);

    if (user) {
      try {
        await updateDoc(doc(db, 'officers', subLo.id), {
          assignedLoId: targetLo.id,
          updatedAt: serverTimestamp(),
        });
        const { id, ...logPayload } = newLog;
        await addDoc(collection(db, 'assignmentLogs'), {
          ...logPayload,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `officers/${subLo.id}`);
      }
    }
  };

  const handleUpdateHierarchyRule = async (newRule: HierarchyRule) => {
    const updated: SystemConfig = {
      ...config,
      hierarchyRule: newRule,
    };
    setConfig(updated);
    showToast(
      `Reporting hierarchy rule set to ${
        newRule === '1_to_1'
          ? '1 LO → 1 Sub-LO'
          : newRule === '1_to_5'
          ? '1 LO → 5 Sub-LOs'
          : '1 LO → Unlimited Sub-LOs'
      }`
    );

    if (user) {
      try {
        await setDoc(
          doc(db, 'configs', config.id),
          {
            ...updated,
            ownerId: user.uid,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `configs/${config.id}`);
      }
    }
  };

  const handleCreateOfficerRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regForm.fullName.trim() || !regForm.registrationNumber.trim()) {
      showToast('Full Name and Registration Number are required.', 'error');
      return;
    }

    let targetLoId = '';
    if (regForm.designation === 'Sub-LO' && regForm.assignedLoId) {
      if (regForm.approvalStatus === 'Approved') {
        const targetLo = loList.find((l) => l.id === regForm.assignedLoId);
        if (targetLo) {
          const currentCount = getSubLosForLo(targetLo.id).length;
          const maxLimit = getMaxSubLoLimit(config.hierarchyRule);
          if (currentCount >= maxLimit) {
            showToast(
              `Hierarchy Rule Violation: LO ${targetLo.fullName} already has ${currentCount}/${maxLimit} Sub-LOs.`,
              'error'
            );
            return;
          }
          targetLoId = targetLo.id;
        }
      }
    }

    const newId = `off_${Date.now()}`;
    const nextCode =
      regForm.officerCode.trim() ||
      (regForm.designation === 'Sub-LO'
        ? String(subLoList.length + 1).padStart(3, '0')
        : regForm.designation === 'LO'
        ? `LO-${101 + loList.length}`
        : 'MLO-02');

    const newOfficer: Officer = {
      id: newId,
      ownerId: user?.uid || DEMO_UID,
      officerCode: nextCode,
      fullName: regForm.fullName.trim(),
      designation: regForm.designation,
      companyName: regForm.companyName.trim(),
      registrationNumber: regForm.registrationNumber.trim(),
      badgeCategory: regForm.badgeCategory.trim() || 'Badge Category LO',
      assignedMasterLoId:
        regForm.designation === 'Master LO'
          ? ''
          : masterLo?.id || regForm.assignedMasterLoId,
      assignedLoId: targetLoId,
      assignedSubLoId: '',
      approvalStatus: regForm.approvalStatus,
      airportAssignment: regForm.airportAssignment.trim(),
    };

    const newVault: OfficerVault = {
      id: 'primary',
      ownerId: user?.uid || DEMO_UID,
      officerId: newId,
      contactNumber: regForm.contactNumber.trim() || '+91 98201 00000',
      idDocumentType: 'Official Protocol Commission Pass',
      idDocumentNumber: `ID-${newOfficer.registrationNumber}`,
      signatureText: `${newOfficer.fullName} (${newOfficer.designation})`,
      photoStyle: 'navy',
      verifiedByStaff: newOfficer.approvalStatus === 'Approved',
    };

    setOfficers((prev) => [...prev, newOfficer]);
    setVaultMap((prev) => ({ ...prev, [newId]: newVault }));
    showToast(`Registered ${newOfficer.designation}: ${newOfficer.fullName}`);

    setRegForm({
      ...regForm,
      fullName: '',
      officerCode: '',
      registrationNumber: '',
    });

    if (user) {
      try {
        const { id: _id, ...offData } = newOfficer;
        await setDoc(doc(db, 'officers', newId), {
          ...offData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        const { id: _vId, ...vData } = newVault;
        await setDoc(doc(db, 'officers', newId, 'vault', 'primary'), {
          ...vData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `officers/${newId}`);
      }
    }
  };

  const handleQuickFillOfficerSample = () => {
    const nextNum = subLoList.length + 1;
    const code = String(nextNum).padStart(3, '0');
    setRegForm({
      fullName: 'Aarav Kulkarni',
      designation: 'Sub-LO',
      officerCode: code,
      companyName: 'Protocol Field Escort Unit',
      registrationNumber: `REG-SLO-2026-${code}`,
      badgeCategory: 'Badge Category LO - Silver',
      assignedMasterLoId: masterLo?.id || '',
      assignedLoId: loList[0]?.id || '',
      approvalStatus: 'Approved',
      airportAssignment: 'Terminal 2 — International Gate B',
      contactNumber: '+91 98203 77410',
    });
    showToast('Pre-filled sample Sub-LO registration');
  };

  // Filtered LO directory
  const filteredOfficers = useMemo(() => {
    return officers.filter((o) => {
      const matchesSearch =
        o.fullName.toLowerCase().includes(loSearch.toLowerCase()) ||
        o.registrationNumber.toLowerCase().includes(loSearch.toLowerCase()) ||
        o.officerCode.toLowerCase().includes(loSearch.toLowerCase()) ||
        o.companyName.toLowerCase().includes(loSearch.toLowerCase());
      const matchesDesig =
        designationFilter === 'ALL' || o.designation === designationFilter;
      const matchesStatus =
        statusFilter === 'ALL' || o.approvalStatus === statusFilter;
      return matchesSearch && matchesDesig && matchesStatus;
    });
  }, [officers, loSearch, designationFilter, statusFilter]);

  const approvedCount = officers.filter((o) => o.approvalStatus === 'Approved').length;
  const pendingCount = officers.filter((o) => o.approvalStatus === 'Pending').length;
  const activeArrivalsCount = delegates.filter((d) => d.arrivalFlight).length;
  const activeDeparturesCount = delegates.filter((d) => d.departureFlight).length;

  const navSections: {
    heading: string;
    items: { id: NavigationTab; label: string; icon: React.ReactNode; count?: number }[];
  }[] = [
    {
      heading: 'Command & Hierarchy',
      items: [
        { id: 'overview', label: 'Master LO Dashboard', icon: <Compass className="w-4 h-4" /> },
        { id: 'lo_list', label: 'Officer Roster', icon: <Users className="w-4 h-4" />, count: officers.length },
        { id: 'sub_lo_list', label: 'Sub-LO Allocations', icon: <UserCheck className="w-4 h-4" />, count: subLoList.length },
        { id: 'registration', label: 'Register Officer', icon: <UserPlus className="w-4 h-4" /> },
        { id: 'configuration', label: 'Hierarchy Rules', icon: <Settings className="w-4 h-4" /> },
      ],
    },
    {
      heading: 'VIP Protocol & Logistics',
      items: [
        { id: 'delegates', label: 'VIP Delegates', icon: <Shield className="w-4 h-4" />, count: delegates.length },
        { id: 'airport_transport', label: 'Flights & Fleet', icon: <Plane className="w-4 h-4" />, count: activeArrivalsCount },
        { id: 'hotels', label: 'Hotels & Suites', icon: <Building2 className="w-4 h-4" /> },
        { id: 'documents_reports', label: 'Dossiers & Exports', icon: <FileSpreadsheet className="w-4 h-4" /> },
      ],
    },
    {
      heading: 'Field Operations',
      items: [
        { id: 'lo_app', label: 'Field Escort App', icon: <Smartphone className="w-4 h-4" /> },
      ],
    },
  ];

  const activeTabLabel =
    navSections.flatMap((s) => s.items).find((i) => i.id === activeTab)?.label ||
    'Master LO Dashboard';

  const sharedLogisticsProps = {
    officers,
    vaultMap,
    delegates,
    assignmentLogs,
    config,
    currentUserId: user?.uid || null,
    onSelectOfficerForVault: (off: Officer) => setVaultOfficer(off),
    onLocalDelegateCreate: (del: DelegateRecord) => {
      setDelegates((prev) => [del, ...prev]);
      showToast(`Registered VIP Delegate: ${del.delegateName}`);
    },
    onLocalDelegateUpdate: (id: string, patch: Partial<DelegateRecord>) => {
      setDelegates((prev) =>
        prev.map((d) => (d.id === id ? { ...d, ...patch } : d))
      );
      showToast('Updated delegate logistics record');
    },
    onLocalDelegateDelete: (id: string) => {
      setDelegates((prev) => prev.filter((d) => d.id !== id));
      showToast('Removed delegate record');
    },
  };

  return (
    <div className="min-h-screen bg-[#F7F6F2] text-[#14213D] flex flex-col">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-lg border shadow-lg flex items-center gap-2.5 text-xs font-semibold transition-all ${
            toastMessage.type === 'error'
              ? 'bg-[#B91C1C] text-white border-[#991B1B]'
              : 'bg-[#14213D] text-white border-[#1E293B]'
          }`}
        >
          {toastMessage.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#34D399]" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Editorial Command Header */}
      <header className="h-16 bg-white border-b border-[#E6E4DD] px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-[#14213D] text-[#FCD34D] flex items-center justify-center font-serif font-bold text-base tracking-wider shadow-xs">
            LO
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-serif text-lg font-bold tracking-tight text-[#14213D]">
                Liaison Officer Command Centre
              </span>
              <span className="hidden sm:inline-block text-[11px] font-mono uppercase tracking-wider px-2 py-0.5 bg-[#F2EFE9] text-[#525866] border border-[#E6E4DD] rounded-md">
                Master LO · {masterLo?.fullName || 'Vinod Kr. Pandey'}
              </span>
            </div>
            <p className="text-xs text-[#64748B]">
              Central Protocol Administration · Team Allocations · VIP Movements
            </p>
          </div>
        </div>

        {/* Right Global Actions */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#F7F6F2] border border-[#E6E4DD] text-xs text-[#525866]">
            <span className="font-medium text-[#64748B]">Hierarchy:</span>
            <span className="font-mono font-semibold text-[#14213D]">
              {config.hierarchyRule === '1_to_1'
                ? '1 LO → 1 Sub-LO'
                : config.hierarchyRule === '1_to_5'
                ? '1 LO → Max 5 Sub-LOs'
                : '1 LO → Unlimited'}
            </span>
          </div>

          <button
            onClick={() =>
              exportMasterExcelWorkbook(
                officers,
                vaultMap,
                delegates,
                assignmentLogs,
                config
              )
            }
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold bg-[#1D4ED8] text-white hover:bg-[#1E40AF] transition-colors cursor-pointer shadow-xs"
            title="Download Master 8-Sheet Excel Workbook (.xlsx)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export 8-Sheet Workbook</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col lg:flex-row max-w-[1440px] w-full mx-auto">
        {/* Left Navigation Sidebar */}
        <aside className="w-full lg:w-64 bg-white border-b lg:border-b-0 lg:border-r border-[#E6E4DD] shrink-0 flex flex-col justify-between p-4">
          <div className="space-y-6">
            {navSections.map((section) => (
              <div key={section.heading}>
                <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#7E8694]">
                  {section.heading}
                </div>
                <nav className="space-y-1">
                  {section.items.map((item) => {
                    const active = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#14213D] text-white font-semibold shadow-xs'
                            : 'text-[#475569] hover:bg-[#F7F6F2] hover:text-[#14213D]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className={active ? 'text-[#FCD34D]' : 'text-[#64748B]'}>
                            {item.icon}
                          </span>
                          <span>{item.label}</span>
                        </div>
                        {item.count !== undefined && (
                          <span
                            className={`font-mono text-[11px] tabular-nums px-1.5 py-0.5 rounded ${
                              active
                                ? 'bg-white/15 text-white'
                                : 'bg-[#F2EFE9] text-[#525866]'
                            }`}
                          >
                            {item.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </nav>
              </div>
            ))}
          </div>

          {/* Bottom Workspace Sync & Reset Controls */}
          <div className="mt-6 pt-4 border-t border-[#E6E4DD] space-y-2.5">
            {user ? (
              <div className="p-3 rounded-lg bg-[#F7F6F2] border border-[#E6E4DD]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#047857] font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#047857]" />
                    Cloud Synced
                  </span>
                  <button
                    onClick={() => signOut(auth)}
                    className="text-[11px] text-[#64748B] hover:text-[#B91C1C] inline-flex items-center gap-1 cursor-pointer"
                    title="Sign Out"
                  >
                    <LogOut className="w-3 h-3" />
                  </button>
                </div>
                <p className="text-xs font-semibold text-[#14213D] truncate">
                  {user.displayName || 'Administrator'}
                </p>
                <p className="text-[11px] text-[#64748B] truncate">{user.email}</p>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-[#F7F6F2] border border-[#E6E4DD]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold text-[#14213D]">
                    Interactive Workspace
                  </span>
                  <span className="w-2 h-2 rounded-full bg-[#047857]" />
                </div>
                <p className="text-[11px] text-[#525866] leading-relaxed mb-2.5">
                  All approvals, assignments, and exports work immediately. Sign in to sync with Cloud Firestore.
                </p>
                <button
                  onClick={handleGoogleSignIn}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-white border border-[#D5D2C8] text-[#14213D] hover:bg-[#F2EFE9] transition-colors cursor-pointer"
                >
                  <Cloud className="w-3.5 h-3.5 text-[#1D4ED8]" />
                  <span>Sync with Google Cloud</span>
                </button>
                {authError && (
                  <p className="text-[10px] text-[#B91C1C] mt-1.5">{authError}</p>
                )}
              </div>
            )}

            <button
              onClick={handleResetDemoData}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium text-[#64748B] hover:text-[#14213D] hover:bg-[#F2EFE9] transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Restore Default Roster</span>
            </button>
          </div>
        </aside>

        {/* Main Content Canvas */}
        <main className="flex-1 p-6 lg:p-8 space-y-6 overflow-y-auto">
          {/* Contextual Page Sub-Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#E6E4DD]">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-widest text-[#B45309] font-semibold">
                Protocol Command · Active Section
              </div>
              <h1 className="font-serif text-2xl font-bold text-[#14213D] mt-0.5">
                {activeTabLabel}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {activeTab !== 'registration' && (
                <button
                  onClick={() => setActiveTab('registration')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-semibold bg-white border border-[#D5D2C8] text-[#14213D] hover:bg-[#F2EFE9] transition-colors cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5 text-[#1D4ED8]" />
                  <span>+ Register LO / Sub-LO</span>
                </button>
              )}
              {activeTab !== 'lo_app' && (
                <button
                  onClick={() => setActiveTab('lo_app')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-semibold bg-[#14213D] text-white hover:bg-[#1E293B] transition-colors cursor-pointer"
                >
                  <Smartphone className="w-3.5 h-3.5 text-[#FCD34D]" />
                  <span>Open Field Escort App</span>
                </button>
              )}
            </div>
          </div>

          {/* 4-Card KPI Summary Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              onClick={() => setActiveTab('lo_list')}
              className="bg-white border border-[#E6E4DD] rounded-lg p-5 hover:border-[#14213D]/40 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-[#525866] mb-2">
                <span>Total Officers</span>
                <span className="font-mono text-[11px] text-[#14213D] bg-[#F7F6F2] px-2 py-0.5 rounded border border-[#E6E4DD]">
                  Master: {masterLo?.fullName || 'Vinod Kr. Pandey'}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="font-serif text-3xl font-bold tabular-nums text-[#14213D]">
                  {officers.length}
                </span>
                <span className="text-xs text-[#64748B] font-mono tabular-nums">
                  {loList.length} LOs · {subLoList.length} Sub-LOs
                </span>
              </div>
            </div>

            <div
              onClick={() => setActiveTab('sub_lo_list')}
              className="bg-white border border-[#E6E4DD] rounded-lg p-5 hover:border-[#047857]/40 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-[#525866] mb-2">
                <span>Approval Status</span>
                <span className="inline-flex items-center gap-1.5 text-[#047857] font-mono text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-[#047857]" />
                  Cleared
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="font-serif text-3xl font-bold tabular-nums text-[#047857]">
                  {approvedCount}
                </span>
                <span className="text-xs text-[#B45309] font-mono tabular-nums font-medium">
                  {pendingCount} Pending Review
                </span>
              </div>
            </div>

            <div
              onClick={() => setActiveTab('airport_transport')}
              className="bg-white border border-[#E6E4DD] rounded-lg p-5 hover:border-[#1D4ED8]/40 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-[#525866] mb-2">
                <span>VIP Airport Arrivals</span>
                <Plane className="w-4 h-4 text-[#1D4ED8]" />
              </div>
              <div className="flex items-baseline justify-between">
                <span className="font-serif text-3xl font-bold tabular-nums text-[#14213D]">
                  {activeArrivalsCount}
                </span>
                <span className="text-xs text-[#64748B] font-mono">
                  Active Flight Pickups
                </span>
              </div>
            </div>

            <div
              onClick={() => setActiveTab('airport_transport')}
              className="bg-white border border-[#E6E4DD] rounded-lg p-5 hover:border-[#B45309]/40 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-[#525866] mb-2">
                <span>Scheduled Departures</span>
                <Clock className="w-4 h-4 text-[#B45309]" />
              </div>
              <div className="flex items-baseline justify-between">
                <span className="font-serif text-3xl font-bold tabular-nums text-[#14213D]">
                  {activeDeparturesCount}
                </span>
                <span className="text-xs text-[#64748B] font-mono">
                  Outbound Drop-offs
                </span>
              </div>
            </div>
          </div>

          {/* TAB 1: MASTER LO OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Command Hierarchy Matrix: Master LO -> LOs -> Sub-LOs */}
              <div className="bg-white border border-[#E6E4DD] rounded-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-[#E6E4DD] flex flex-wrap items-center justify-between gap-4 bg-[#FAF9F5]">
                  <div>
                    <span className="text-[11px] font-mono uppercase tracking-wider text-[#B45309] font-semibold">
                      Live Command Structure
                    </span>
                    <h2 className="font-serif text-lg font-bold text-[#14213D]">
                      Master LO ({masterLo?.fullName || 'Vinod Kr. Pandey'}) — Team Allocation Matrix
                    </h2>
                  </div>

                  {/* Quick Rule Switcher */}
                  <div className="flex items-center gap-1.5 bg-white p-1 rounded-md border border-[#E6E4DD]">
                    <span className="text-[11px] font-medium text-[#64748B] px-2">
                      Rule:
                    </span>
                    {(
                      [
                        { id: '1_to_1', label: '1 → 1' },
                        { id: '1_to_5', label: '1 → 5' },
                        { id: 'unlimited', label: 'Unlimited' },
                      ] as { id: HierarchyRule; label: string }[]
                    ).map((r) => (
                      <button
                        key={r.id}
                        onClick={() => handleUpdateHierarchyRule(r.id)}
                        className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors cursor-pointer ${
                          config.hierarchyRule === r.id
                            ? 'bg-[#14213D] text-white'
                            : 'text-[#525866] hover:bg-[#F7F6F2]'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3 LO Columns under Master LO */}
                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-5">
                  {loList.map((lo) => {
                    const teamSubLos = getSubLosForLo(lo.id);
                    const loDelegates = delegates.filter((d) => d.loId === lo.id);
                    const maxLimit = getMaxSubLoLimit(config.hierarchyRule);
                    return (
                      <div
                        key={lo.id}
                        className="border border-[#E6E4DD] rounded-lg p-5 bg-[#FAF9F5]/60 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between border-b border-[#E6E4DD] pb-3 mb-3">
                            <div className="flex items-center gap-3">
                              <OfficerPortraitSvg
                                fullName={lo.fullName}
                                styleTone={vaultMap[lo.id]?.photoStyle || 'navy'}
                                size="sm"
                              />
                              <div>
                                <span className="text-[10px] font-mono uppercase tracking-wider text-[#1D4ED8] font-semibold">
                                  LO · {lo.officerCode}
                                </span>
                                <h3 className="font-serif text-lg font-bold text-[#14213D]">
                                  {lo.fullName}
                                </h3>
                                <p className="text-xs text-[#64748B] truncate max-w-[180px]">
                                  {lo.airportAssignment}
                                </p>
                              </div>
                            </div>
                            <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded bg-white border border-[#E6E4DD] text-[#14213D] tabular-nums">
                              {teamSubLos.length}/{maxLimit === 9999 ? '∞' : maxLimit}
                            </span>
                          </div>

                          {/* Assigned Sub-LOs */}
                          <div className="space-y-2 mb-4">
                            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
                              Assigned Sub-LOs
                            </div>
                            {teamSubLos.length === 0 ? (
                              <div className="text-xs text-[#64748B] italic py-2">
                                No Sub-LOs currently assigned.
                              </div>
                            ) : (
                              teamSubLos.map((sub) => (
                                <div
                                  key={sub.id}
                                  className="flex items-center justify-between px-3 py-2 rounded-md bg-white border border-[#E6E4DD] text-xs"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-[#1D4ED8] tabular-nums">
                                      #{sub.officerCode}
                                    </span>
                                    <span className="font-semibold text-[#14213D]">
                                      {sub.fullName}
                                    </span>
                                  </div>
                                  <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[#047857]">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#047857]" />
                                    {sub.approvalStatus}
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        <div className="pt-3 border-t border-[#E6E4DD] flex items-center justify-between text-xs">
                          <span className="text-[#525866] font-mono tabular-nums">
                            VIP Delegates: <strong className="text-[#14213D]">{loDelegates.length}</strong>
                          </span>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => setVaultOfficer(lo)}
                              className="text-[#64748B] hover:text-[#14213D] font-medium cursor-pointer"
                            >
                              Vault
                            </button>
                            <button
                              onClick={() => setActiveTab('lo_app')}
                              className="text-[#1D4ED8] hover:underline font-semibold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <span>Field Desk</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Two-column Quick Approval & Live Flight Schedule */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Sub-LO Quick Approval & Reassignment */}
                <div className="bg-white border border-[#E6E4DD] rounded-lg overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#E6E4DD] flex items-center justify-between bg-[#FAF9F5]">
                    <div>
                      <h3 className="font-serif text-base font-bold text-[#14213D]">
                        Sub-LO Roster & Instant Allocation
                      </h3>
                      <p className="text-xs text-[#64748B]">
                        Approve or reassign Sub-LOs (001–004) directly
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab('sub_lo_list')}
                      className="text-xs font-semibold text-[#1D4ED8] hover:underline cursor-pointer"
                    >
                      Full Workflow →
                    </button>
                  </div>
                  <div className="divide-y divide-[#E6E4DD]">
                    {subLoList.map((sub) => (
                      <div
                        key={sub.id}
                        className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 hover:bg-[#FAF9F5]"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs font-bold px-2 py-1 bg-[#F2EFE9] border border-[#E6E4DD] rounded text-[#14213D] tabular-nums">
                            {sub.officerCode}
                          </span>
                          <div>
                            <div className="text-sm font-semibold text-[#14213D]">
                              {sub.fullName}
                            </div>
                            <div className="text-xs text-[#64748B]">
                              {sub.airportAssignment}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <select
                            value={sub.approvalStatus}
                            onChange={(e) =>
                              handleUpdateApproval(sub, e.target.value as ApprovalStatus)
                            }
                            className={`px-2.5 py-1 rounded text-xs font-semibold border cursor-pointer ${
                              sub.approvalStatus === 'Approved'
                                ? 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]'
                                : sub.approvalStatus === 'Disapproved'
                                ? 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]'
                                : 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]'
                            }`}
                          >
                            <option value="Pending">Pending</option>
                            <option value="Approved">Approved</option>
                            <option value="Disapproved">Disapproved</option>
                          </select>

                          <select
                            value={sub.assignedLoId || ''}
                            disabled={sub.approvalStatus !== 'Approved'}
                            onChange={(e) => handleAssignSubLoToLo(sub, e.target.value)}
                            className="px-2.5 py-1 rounded border border-[#D5D2C8] bg-white text-xs font-medium text-[#14213D] disabled:opacity-50"
                          >
                            <option value="">Unassigned</option>
                            {loList.map((lo) => (
                              <option key={lo.id} value={lo.id}>
                                LO: {lo.fullName}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Active VIP Delegate Movements */}
                <div className="bg-white border border-[#E6E4DD] rounded-lg overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#E6E4DD] flex items-center justify-between bg-[#FAF9F5]">
                    <div>
                      <h3 className="font-serif text-base font-bold text-[#14213D]">
                        VIP Delegate Movements
                      </h3>
                      <p className="text-xs text-[#64748B]">
                        Real-time airport pickups, hotel check-ins & protocol cars
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab('delegates')}
                      className="text-xs font-semibold text-[#1D4ED8] hover:underline cursor-pointer"
                    >
                      Manage Delegates →
                    </button>
                  </div>
                  <div className="divide-y divide-[#E6E4DD]">
                    {delegates.map((del) => (
                      <div key={del.id} className="px-5 py-3.5 hover:bg-[#FAF9F5]">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-semibold text-[#14213D]">
                              {del.delegateName}
                            </div>
                            <div className="text-xs text-[#64748B]">
                              {del.company} · Handler: <strong className="text-[#14213D]">{del.assignedHandler}</strong>
                            </div>
                          </div>
                          <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]">
                            {del.pickupStatus}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-[#525866] font-mono tabular-nums">
                          <span>Flight: {del.arrivalFlight}</span>
                          <span>Hotel: {del.hotelName} ({del.roomDetails})</span>
                          <span>Car: {del.vehicleNumber}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: OFFICER ROSTER (LO & SUB-LO DIRECTORY) */}
          {activeTab === 'lo_list' && (
            <div className="bg-white border border-[#E6E4DD] rounded-lg overflow-hidden">
              <div className="p-5 border-b border-[#E6E4DD] flex flex-wrap items-center justify-between gap-4 bg-[#FAF9F5]">
                <div>
                  <h2 className="font-serif text-lg font-bold text-[#14213D]">
                    Master Officer Roster
                  </h2>
                  <p className="text-xs text-[#64748B]">
                    Filter officers, open credential vaults, or export individual PDF dossiers
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={loSearch}
                      onChange={(e) => setLoSearch(e.target.value)}
                      placeholder="Search name, ID, code..."
                      className="pl-8 pr-3 py-1.5 rounded-md border border-[#D5D2C8] bg-white text-xs text-[#14213D] focus:outline-none focus:border-[#1D4ED8]"
                    />
                  </div>

                  <select
                    value={designationFilter}
                    onChange={(e) => setDesignationFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-md border border-[#D5D2C8] bg-white text-xs font-medium text-[#14213D]"
                  >
                    <option value="ALL">All Designations</option>
                    <option value="Master LO">Master LO</option>
                    <option value="LO">LO</option>
                    <option value="Sub-LO">Sub-LO</option>
                  </select>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-md border border-[#D5D2C8] bg-white text-xs font-medium text-[#14213D]"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="Approved">Approved</option>
                    <option value="Pending">Pending</option>
                    <option value="Disapproved">Disapproved</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#E6E4DD] text-[11px] font-semibold uppercase tracking-wider text-[#64748B] bg-[#FAF9F5]">
                      <th className="py-3 px-4">Officer</th>
                      <th className="py-3 px-4">Role & Code</th>
                      <th className="py-3 px-4">Reg. Number</th>
                      <th className="py-3 px-4">Reporting To</th>
                      <th className="py-3 px-4">Airport Post</th>
                      <th className="py-3 px-4">Approval Status</th>
                      <th className="py-3 px-4 text-right">Dossier & Vault</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6E4DD] text-xs">
                    {filteredOfficers.map((o) => (
                      <tr key={o.id} className="hover:bg-[#FAF9F5] transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <OfficerPortraitSvg
                              fullName={o.fullName}
                              styleTone={vaultMap[o.id]?.photoStyle || 'navy'}
                              size="sm"
                            />
                            <div>
                              <div className="font-semibold text-[#14213D]">{o.fullName}</div>
                              <div className="text-[11px] text-[#64748B]">{o.companyName}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono">
                          <span className="font-semibold text-[#14213D]">{o.designation}</span>
                          <span className="ml-1.5 text-[#1D4ED8] font-bold">
                            #{o.officerCode}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono tabular-nums text-[#525866]">
                          {o.registrationNumber}
                        </td>
                        <td className="py-3.5 px-4">
                          {o.designation === 'Master LO' ? (
                            <span className="text-[#64748B]">Central Command</span>
                          ) : o.designation === 'LO' ? (
                            <span>
                              Master LO: <strong>{masterLo?.fullName || 'Vinod Kr. Pandey'}</strong>
                            </span>
                          ) : (
                            <span>
                              LO: <strong className="text-[#14213D]">{getLoName(o.assignedLoId)}</strong>
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-[#525866]">
                          <div>{o.airportAssignment || '—'}</div>
                          <div className="font-mono text-[11px] tabular-nums text-[#64748B]">
                            {vaultMap[o.id]?.contactNumber || '+91 98201 00000'}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <select
                            value={o.approvalStatus}
                            onChange={(e) =>
                              handleUpdateApproval(o, e.target.value as ApprovalStatus)
                            }
                            className={`px-2.5 py-1 rounded text-xs font-semibold border cursor-pointer ${
                              o.approvalStatus === 'Approved'
                                ? 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]'
                                : o.approvalStatus === 'Disapproved'
                                ? 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]'
                                : 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]'
                            }`}
                          >
                            <option value="Pending">Pending</option>
                            <option value="Approved">Approved</option>
                            <option value="Disapproved">Disapproved</option>
                          </select>
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-2">
                          <button
                            onClick={() => setVaultOfficer(o)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-[#D5D2C8] bg-white hover:bg-[#F2EFE9] text-[#14213D] font-medium cursor-pointer"
                            title="Inspect Photo, ID & Signature Vault"
                          >
                            <Lock className="w-3 h-3 text-[#B45309]" />
                            <span>Vault</span>
                          </button>
                          <button
                            onClick={() =>
                              exportIndividualLoPdf(
                                o,
                                vaultMap[o.id],
                                officers,
                                delegates
                              )
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#14213D] text-white hover:bg-[#1E293B] font-medium cursor-pointer"
                            title="Export Official PDF Profile"
                          >
                            <FileText className="w-3 h-3 text-[#FCD34D]" />
                            <span>PDF</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: SUB-LO APPROVAL & ASSIGNMENT WORKFLOW */}
          {activeTab === 'sub_lo_list' && (
            <div className="space-y-6">
              <div className="bg-white border border-[#E6E4DD] rounded-lg overflow-hidden">
                <div className="p-5 border-b border-[#E6E4DD] flex flex-wrap items-center justify-between gap-4 bg-[#FAF9F5]">
                  <div>
                    <span className="text-[11px] font-mono uppercase tracking-wider text-[#B45309] font-semibold">
                      Step 1 & Step 2 · Approval & Team Allocation
                    </span>
                    <h2 className="font-serif text-lg font-bold text-[#14213D]">
                      Sub-LO Verification & LO Team Assignment
                    </h2>
                    <p className="text-xs text-[#64748B]">
                      Only Approved Sub-LOs can be assigned to an active LO. Active Rule:{' '}
                      <strong className="font-mono text-[#14213D]">
                        {config.hierarchyRule === '1_to_1'
                          ? '1 LO → 1 Sub-LO'
                          : config.hierarchyRule === '1_to_5'
                          ? '1 LO → 5 Sub-LOs'
                          : '1 LO → Unlimited Sub-LOs'}
                      </strong>
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#E6E4DD] text-[11px] font-semibold uppercase tracking-wider text-[#64748B] bg-[#FAF9F5]">
                        <th className="py-3 px-4">Sub-LO ID</th>
                        <th className="py-3 px-4">Name</th>
                        <th className="py-3 px-4">Designation</th>
                        <th className="py-3 px-4">Step 1: Approval Action</th>
                        <th className="py-3 px-4">Step 2: Assign to LO</th>
                        <th className="py-3 px-4">Airport Post</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E6E4DD] text-xs">
                      {subLoList.map((sub) => (
                        <tr key={sub.id} className="hover:bg-[#FAF9F5]">
                          <td className="py-3.5 px-4 font-mono font-bold text-[#1D4ED8] tabular-nums">
                            {sub.officerCode}
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-[#14213D]">
                            {sub.fullName}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[#525866]">
                            {sub.designation}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="inline-flex items-center gap-1.5">
                              {(['Approved', 'Pending', 'Disapproved'] as ApprovalStatus[]).map(
                                (status) => {
                                  const active = sub.approvalStatus === status;
                                  return (
                                    <button
                                      key={status}
                                      onClick={() => handleUpdateApproval(sub, status)}
                                      className={`px-2.5 py-1 rounded text-xs font-semibold border transition-colors cursor-pointer ${
                                        active
                                          ? status === 'Approved'
                                            ? 'bg-[#047857] text-white border-[#047857]'
                                            : status === 'Disapproved'
                                            ? 'bg-[#B91C1C] text-white border-[#B91C1C]'
                                            : 'bg-[#B45309] text-white border-[#B45309]'
                                          : 'bg-white text-[#525866] border-[#D5D2C8] hover:bg-[#F7F6F2]'
                                      }`}
                                    >
                                      {status}
                                    </button>
                                  );
                                }
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <select
                              value={sub.assignedLoId || ''}
                              disabled={sub.approvalStatus !== 'Approved'}
                              onChange={(e) =>
                                handleAssignSubLoToLo(sub, e.target.value)
                              }
                              className="px-3 py-1.5 rounded-md border border-[#D5D2C8] bg-white text-xs font-semibold text-[#14213D] disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <option value="">-- Unassigned --</option>
                              {loList.map((lo) => (
                                <option key={lo.id} value={lo.id}>
                                  {lo.fullName} ({getSubLosForLo(lo.id).length} assigned)
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-3.5 px-4 text-[#525866]">
                            {sub.airportAssignment}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Assignment Audit History */}
              <div className="bg-white border border-[#E6E4DD] rounded-lg overflow-hidden">
                <div className="px-5 py-4 border-b border-[#E6E4DD] flex items-center gap-2 bg-[#FAF9F5]">
                  <History className="w-4 h-4 text-[#B45309]" />
                  <h3 className="font-serif text-base font-bold text-[#14213D]">
                    LO–Sub-LO Assignment History
                  </h3>
                </div>
                <div className="divide-y divide-[#E6E4DD] text-xs">
                  {assignmentLogs.map((log) => (
                    <div
                      key={log.id}
                      className="px-5 py-3 flex flex-wrap items-center justify-between gap-2"
                    >
                      <div>
                        <span className="font-mono font-bold text-[#1D4ED8] mr-2">
                          #{log.subLoCode}
                        </span>
                        <strong className="text-[#14213D]">{log.subLoName}</strong>{' '}
                        <span className="text-[#64748B]">reassigned from</span>{' '}
                        <span className="font-mono text-[#525866]">{log.previousLoName}</span>{' '}
                        <span className="text-[#64748B]">to LO</span>{' '}
                        <strong className="text-[#047857]">{log.newLoName}</strong>
                      </div>
                      <div className="font-mono text-[11px] text-[#64748B]">
                        Rule: {log.hierarchyRuleApplied}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: LO / SUB-LO REGISTRATION FORM */}
          {activeTab === 'registration' && (
            <div className="max-w-3xl bg-white border border-[#E6E4DD] rounded-lg overflow-hidden">
              <div className="px-6 py-5 border-b border-[#E6E4DD] flex flex-wrap items-center justify-between gap-3 bg-[#FAF9F5]">
                <div>
                  <span className="text-[11px] font-mono uppercase tracking-wider text-[#B45309] font-semibold">
                    Protocol Onboarding
                  </span>
                  <h2 className="font-serif text-lg font-bold text-[#14213D]">
                    LO / Sub-LO Registration Form
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={handleQuickFillOfficerSample}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-white border border-[#D5D2C8] text-[#14213D] hover:bg-[#F2EFE9] cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#B45309]" />
                  <span>Auto-Fill Sample Sub-LO</span>
                </button>
              </div>

              <form onSubmit={handleCreateOfficerRecord} className="p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#14213D] mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={regForm.fullName}
                      onChange={(e) =>
                        setRegForm({ ...regForm, fullName: e.target.value })
                      }
                      placeholder="e.g., Poojan / Rushi"
                      className="w-full px-3 py-2 rounded-md border border-[#D5D2C8] text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#14213D] mb-1">
                      Designation *
                    </label>
                    <select
                      value={regForm.designation}
                      onChange={(e) =>
                        setRegForm({
                          ...regForm,
                          designation: e.target.value as Designation,
                        })
                      }
                      className="w-full px-3 py-2 rounded-md border border-[#D5D2C8] bg-white text-xs font-medium"
                    >
                      <option value="Master LO">Master LO</option>
                      <option value="LO">LO</option>
                      <option value="Sub-LO">Sub-LO</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#14213D] mb-1">
                      Company Name
                    </label>
                    <input
                      type="text"
                      value={regForm.companyName}
                      onChange={(e) =>
                        setRegForm({ ...regForm, companyName: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-md border border-[#D5D2C8] text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#14213D] mb-1">
                      Registration Number *
                    </label>
                    <input
                      type="text"
                      required
                      value={regForm.registrationNumber}
                      onChange={(e) =>
                        setRegForm({
                          ...regForm,
                          registrationNumber: e.target.value,
                        })
                      }
                      placeholder="e.g., REG-SLO-2026-005"
                      className="w-full px-3 py-2 rounded-md border border-[#D5D2C8] text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#14213D] mb-1">
                      Badge Category
                    </label>
                    <input
                      type="text"
                      value={regForm.badgeCategory}
                      onChange={(e) =>
                        setRegForm({ ...regForm, badgeCategory: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-md border border-[#D5D2C8] text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#14213D] mb-1">
                      Officer / Sub-LO ID Code (e.g. 005)
                    </label>
                    <input
                      type="text"
                      value={regForm.officerCode}
                      onChange={(e) =>
                        setRegForm({ ...regForm, officerCode: e.target.value })
                      }
                      placeholder="005"
                      className="w-full px-3 py-2 rounded-md border border-[#D5D2C8] text-xs font-mono"
                    />
                  </div>

                  {regForm.designation === 'Sub-LO' && (
                    <div>
                      <label className="block text-xs font-semibold text-[#14213D] mb-1">
                        Assign Reporting LO
                      </label>
                      <select
                        value={regForm.assignedLoId}
                        onChange={(e) =>
                          setRegForm({ ...regForm, assignedLoId: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-md border border-[#D5D2C8] bg-white text-xs"
                      >
                        <option value="">-- Select LO --</option>
                        {loList.map((lo) => (
                          <option key={lo.id} value={lo.id}>
                            {lo.fullName} ({lo.officerCode})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-[#14213D] mb-1">
                      Approval Status
                    </label>
                    <select
                      value={regForm.approvalStatus}
                      onChange={(e) =>
                        setRegForm({
                          ...regForm,
                          approvalStatus: e.target.value as ApprovalStatus,
                        })
                      }
                      className="w-full px-3 py-2 rounded-md border border-[#D5D2C8] bg-white text-xs font-semibold"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Approved">Approved</option>
                      <option value="Disapproved">Disapproved</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#14213D] mb-1">
                      Airport / Terminal Post
                    </label>
                    <input
                      type="text"
                      value={regForm.airportAssignment}
                      onChange={(e) =>
                        setRegForm({
                          ...regForm,
                          airportAssignment: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 rounded-md border border-[#D5D2C8] text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#14213D] mb-1">
                      Contact Number
                    </label>
                    <input
                      type="text"
                      value={regForm.contactNumber}
                      onChange={(e) =>
                        setRegForm({ ...regForm, contactNumber: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-md border border-[#D5D2C8] text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-[#E6E4DD] flex items-center justify-end gap-3">
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-md text-xs font-semibold bg-[#1D4ED8] text-white hover:bg-[#1E40AF] transition-colors cursor-pointer"
                  >
                    Create Registration Record
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 5: HIERARCHY CONFIGURATION */}
          {activeTab === 'configuration' && (
            <div className="max-w-3xl bg-white border border-[#E6E4DD] rounded-lg overflow-hidden">
              <div className="p-6 border-b border-[#E6E4DD] bg-[#FAF9F5]">
                <span className="text-[11px] font-mono uppercase tracking-wider text-[#B45309] font-semibold">
                  Step 3 · Reporting Hierarchy Governance
                </span>
                <h2 className="font-serif text-lg font-bold text-[#14213D] mt-0.5">
                  Configure LO → Sub-LO Allocation Capacity
                </h2>
                <p className="text-xs text-[#64748B] mt-1">
                  Select the active reporting rule. All new Sub-LO assignments are validated against this rule before saving.
                </p>
              </div>

              <div className="p-6 space-y-4">
                {(
                  [
                    {
                      id: '1_to_1',
                      title: '1 LO → 1 Sub-LO',
                      desc: 'Strict one-to-one pairing. Maximum one Sub-LO per Liaison Officer.',
                    },
                    {
                      id: '1_to_5',
                      title: '1 LO → 5 Sub-LOs',
                      desc: 'Standard squad structure. Maximum five Sub-LOs per Liaison Officer.',
                    },
                    {
                      id: 'unlimited',
                      title: '1 LO → Unlimited Sub-LOs',
                      desc: 'Open surge capacity. No fixed ceiling on Sub-LOs assigned to a single LO.',
                    },
                  ] as { id: HierarchyRule; title: string; desc: string }[]
                ).map((option) => {
                  const selected = config.hierarchyRule === option.id;
                  return (
                    <div
                      key={option.id}
                      onClick={() => handleUpdateHierarchyRule(option.id)}
                      className={`p-4 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                        selected
                          ? 'border-[#14213D] bg-[#FAF9F5] shadow-xs'
                          : 'border-[#E6E4DD] bg-white hover:border-[#D5D2C8]'
                      }`}
                    >
                      <div>
                        <div className="font-serif text-base font-bold text-[#14213D]">
                          {option.title}
                        </div>
                        <p className="text-xs text-[#64748B] mt-0.5">{option.desc}</p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded text-xs font-mono font-semibold ${
                          selected
                            ? 'bg-[#14213D] text-white'
                            : 'bg-[#F2EFE9] text-[#525866]'
                        }`}
                      >
                        {selected ? 'Active Rule' : 'Select'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 6: DELEGATE MANAGEMENT */}
          {activeTab === 'delegates' && (
            <DelegateManagementView {...sharedLogisticsProps} />
          )}

          {/* TAB 7: AIRPORT & TRANSPORT */}
          {activeTab === 'airport_transport' && (
            <AirportTransportView {...sharedLogisticsProps} />
          )}

          {/* TAB 8: HOTEL MANAGEMENT */}
          {activeTab === 'hotels' && (
            <HotelManagementView {...sharedLogisticsProps} />
          )}

          {/* TAB 9: DOCUMENTS & REPORTS */}
          {activeTab === 'documents_reports' && (
            <DocumentsReportsView {...sharedLogisticsProps} />
          )}

          {/* TAB 10: LO FIELD APP */}
          {activeTab === 'lo_app' && (
            <LoFieldAppView {...sharedLogisticsProps} />
          )}
        </main>
      </div>

      {/* Secure Officer Credential Vault Modal */}
      {vaultOfficer && (
        <OfficerVaultModal
          officer={vaultOfficer}
          vault={vaultMap[vaultOfficer.id]}
          allOfficers={officers}
          delegates={delegates}
          currentUserId={user?.uid || null}
          onClose={() => setVaultOfficer(null)}
          onVaultSaved={(offId, updatedVault) => {
            setVaultMap((prev) => ({ ...prev, [offId]: updatedVault }));
            showToast(`Updated secure vault for ${vaultOfficer.fullName}`);
          }}
        />
      )}
    </div>
  );
}
