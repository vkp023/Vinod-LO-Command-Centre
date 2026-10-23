import React, { useState } from 'react';
import { X, FileDown, ShieldCheck, Check } from 'lucide-react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Officer, OfficerVault, DelegateRecord } from '../types';
import { exportIndividualLoPdf } from '../utils/exportReports';

interface OfficerVaultModalProps {
  officer: Officer;
  vault: OfficerVault | undefined;
  allOfficers: Officer[];
  delegates: DelegateRecord[];
  currentUserId: string | null;
  onClose: () => void;
  onVaultSaved: (officerId: string, updated: OfficerVault) => void;
}

export const OfficerPortraitSvg: React.FC<{
  fullName: string;
  styleTone?: string;
  size?: 'sm' | 'md' | 'lg';
}> = ({ fullName, styleTone = 'navy', size = 'md' }) => {
  const initials = fullName
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const toneMap: Record<
    string,
    { bg: string; ring: string; suit: string; accent: string }
  > = {
    charcoal: {
      bg: '#F5F3EF',
      ring: '#D6D3CD',
      suit: '#14213D',
      accent: '#B45309',
    },
    navy: {
      bg: '#EFF6FF',
      ring: '#BFDBFE',
      suit: '#1E3A8A',
      accent: '#2563EB',
    },
    emerald: {
      bg: '#ECFDF5',
      ring: '#A7F3D0',
      suit: '#065F46',
      accent: '#059669',
    },
    indigo: {
      bg: '#EEF2FF',
      ring: '#C7D2FE',
      suit: '#312E81',
      accent: '#4F46E5',
    },
    slate: {
      bg: '#F5F5F4',
      ring: '#E7E5E4',
      suit: '#292524',
      accent: '#78716C',
    },
  };

  const palette = toneMap[styleTone] || toneMap.navy;
  const dim = size === 'lg' ? 84 : size === 'md' ? 46 : 38;

  return (
    <svg
      width={dim}
      height={dim}
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="rounded-xl border border-[#E6E4DD] shrink-0"
      aria-label={`Portrait of ${fullName}`}
    >
      <rect width="96" height="96" rx="12" fill={palette.bg} />
      <circle
        cx="48"
        cy="48"
        r="41"
        stroke={palette.ring}
        strokeWidth="1.5"
      />
      <path
        d="M18 90C18 70.1177 31.4315 56 48 56C64.5685 56 78 70.1177 78 90H18Z"
        fill={palette.suit}
      />
      <path d="M41 56L48 76L55 56H41Z" fill="#FFFFFF" />
      <path d="M46 60L48 78L50 60H46Z" fill={palette.accent} />
      <circle cx="48" cy="34" r="16" fill={palette.suit} />
      <text
        x="48"
        y="39"
        textAnchor="middle"
        fill="#FFFFFF"
        fontSize="13"
        fontWeight="700"
        fontFamily="Plus Jakarta Sans, sans-serif"
      >
        {initials}
      </text>
    </svg>
  );
};

export const OfficerVaultModal: React.FC<OfficerVaultModalProps> = ({
  officer,
  vault,
  allOfficers,
  delegates,
  currentUserId,
  onClose,
  onVaultSaved,
}) => {
  const [contactNumber, setContactNumber] = useState(
    vault?.contactNumber || '+91 98201 00000'
  );
  const [idDocumentType, setIdDocumentType] = useState(
    vault?.idDocumentType || 'Government Protocol ID'
  );
  const [idDocumentNumber, setIdDocumentNumber] = useState(
    vault?.idDocumentNumber || `ID-${officer.registrationNumber}`
  );
  const [signatureText, setSignatureText] = useState(
    vault?.signatureText || officer.fullName
  );
  const [photoStyle, setPhotoStyle] = useState(vault?.photoStyle || 'navy');
  const [verifiedByStaff, setVerifiedByStaff] = useState(
    vault?.verifiedByStaff ?? true
  );
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  const masterLoName = officer.assignedMasterLoId
    ? allOfficers.find((o) => o.id === officer.assignedMasterLoId)?.fullName ||
      'Dayanand'
    : officer.designation === 'Master LO'
    ? 'Self (Master LO)'
    : 'Dayanand';

  const assignedLoName = officer.assignedLoId
    ? allOfficers.find((o) => o.id === officer.assignedLoId)?.fullName || '—'
    : '—';

  const assignedDelegates = delegates.filter(
    (d) =>
      d.masterLoId === officer.id ||
      d.loId === officer.id ||
      d.subLoId === officer.id
  );

  const handleSaveVault = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedNotice(false);

    const updatedVault: OfficerVault = {
      id: 'primary',
      ownerId: currentUserId || 'demo-operator',
      officerId: officer.id,
      contactNumber: contactNumber.trim().slice(0, 40),
      idDocumentType: idDocumentType.trim().slice(0, 64),
      idDocumentNumber: idDocumentNumber.trim().slice(0, 64),
      signatureText: signatureText.trim().slice(0, 120),
      photoStyle: photoStyle.trim().slice(0, 64),
      verifiedByStaff,
    };

    if (currentUserId) {
      const payload = {
        ...updatedVault,
        createdAt: vault?.createdAt ? vault.createdAt : serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      try {
        await setDoc(
          doc(db, 'officers', officer.id, 'vault', 'primary'),
          payload
        );
      } catch (err) {
        handleFirestoreError(
          err,
          vault ? OperationType.UPDATE : OperationType.CREATE,
          `officers/${officer.id}/vault/primary`
        );
      }
    }

    onVaultSaved(officer.id, updatedVault);
    setSavedNotice(true);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#14213D]/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white border border-[#E6E4DD] rounded-2xl max-w-3xl w-full overflow-hidden shadow-sm my-8">
        {/* Oxford Navy Dossier Header */}
        <div className="bg-[#14213D] text-white px-6 py-5 flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <OfficerPortraitSvg
              fullName={officer.fullName}
              styleTone={photoStyle}
              size="lg"
            />
            <div>
              <div className="text-xs text-amber-200/90 font-mono tabular-nums">
                <span>ID {officer.officerCode}</span>
                <span className="mx-2 text-slate-400">·</span>
                <span>{officer.designation}</span>
                <span className="mx-2 text-slate-400">·</span>
                <span
                  className={
                    officer.approvalStatus === 'Approved'
                      ? 'text-emerald-300 font-semibold'
                      : officer.approvalStatus === 'Disapproved'
                      ? 'text-red-300 font-semibold'
                      : 'text-amber-300 font-semibold'
                  }
                >
                  {officer.approvalStatus}
                </span>
              </div>
              <h2 className="text-2xl font-display font-bold tracking-tight text-white mt-1">
                {officer.fullName}
              </h2>
              <p className="text-xs text-slate-200 mt-1">
                {officer.companyName} · Reg.{' '}
                <span className="font-mono tabular-nums">
                  {officer.registrationNumber}
                </span>{' '}
                · {officer.badgeCategory}
              </p>
              <p className="text-xs text-slate-300 mt-1">
                Master LO: {masterLoName}
                {officer.designation === 'Sub-LO' &&
                  ` · Reports to LO: ${assignedLoName}`}{' '}
                · Post: {officer.airportAssignment}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-300 hover:text-white rounded-lg border border-white/15 hover:bg-white/10 transition-colors whitespace-nowrap shrink-0"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Visual ID Credential Card & Specimen Signature */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-[#E6E4DD] rounded-xl p-4 bg-[#F7F6F2] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs text-[#57534E]">
                  <span className="font-semibold text-[#1C1917]">
                    Official Identity Document
                  </span>
                  <span className="font-mono tabular-nums text-[#14213D] font-medium">
                    {idDocumentNumber}
                  </span>
                </div>
                <div className="text-base font-bold text-[#1C1917] mt-1.5">
                  {idDocumentType}
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-[#E6E4DD] flex items-center justify-between text-xs text-[#57534E]">
                <span>Phone: {contactNumber}</span>
                <span className="font-semibold text-[#047857] flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {verifiedByStaff ? 'Verified on File' : 'Pending Review'}
                </span>
              </div>
            </div>

            <div className="border border-[#E6E4DD] rounded-xl p-4 bg-[#F7F6F2] flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-[#57534E]">
                <span className="font-semibold text-[#1C1917]">
                  Authorized Specimen Signature
                </span>
                <span>Staff-Restricted Vault</span>
              </div>
              <div className="my-2.5 py-2.5 px-4 bg-white border border-[#E6E4DD] rounded-lg text-xl italic font-display text-[#14213D] tracking-wide">
                {signatureText || officer.fullName}
              </div>
              <div className="text-xs text-[#57534E] flex items-center justify-between">
                <span>Photograph & ID Linked</span>
                <span className="font-mono tabular-nums">
                  {assignedDelegates.length} Assigned Delegate(s)
                </span>
              </div>
            </div>
          </div>

          {/* Vault Update Form */}
          <form
            onSubmit={handleSaveVault}
            className="space-y-4 pt-4 border-t border-[#E6E4DD]"
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-[#1C1917]">
                Update Officer Credentials (Photograph, ID & Signature)
              </div>
              <span className="text-xs text-[#57534E]">
                Automatically embedded in PDF Profile Exports
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#57534E] mb-1">
                  Direct Contact Number
                </label>
                <input
                  type="text"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  required
                  maxLength={40}
                  className="w-full px-3.5 py-2 text-sm border border-[#D6D3CD] rounded-lg focus:outline-none focus:border-[#1D4ED8] font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#57534E] mb-1">
                  ID Document Type
                </label>
                <input
                  type="text"
                  value={idDocumentType}
                  onChange={(e) => setIdDocumentType(e.target.value)}
                  required
                  maxLength={64}
                  className="w-full px-3.5 py-2 text-sm border border-[#D6D3CD] rounded-lg focus:outline-none focus:border-[#1D4ED8]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#57534E] mb-1">
                  ID Document Reference Number
                </label>
                <input
                  type="text"
                  value={idDocumentNumber}
                  onChange={(e) => setIdDocumentNumber(e.target.value)}
                  required
                  maxLength={64}
                  className="w-full px-3.5 py-2 text-sm border border-[#D6D3CD] rounded-lg focus:outline-none focus:border-[#1D4ED8] font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#57534E] mb-1">
                  Specimen Signature Text
                </label>
                <input
                  type="text"
                  value={signatureText}
                  onChange={(e) => setSignatureText(e.target.value)}
                  required
                  maxLength={120}
                  className="w-full px-3.5 py-2 text-sm border border-[#D6D3CD] rounded-lg focus:outline-none focus:border-[#1D4ED8]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#57534E] mb-1">
                  Official Portrait Attire Theme
                </label>
                <select
                  value={photoStyle}
                  onChange={(e) => setPhotoStyle(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-[#D6D3CD] rounded-lg focus:outline-none focus:border-[#1D4ED8] bg-white"
                >
                  <option value="charcoal">Oxford Navy & Brass Protocol</option>
                  <option value="navy">Royal Sapphire Executive</option>
                  <option value="emerald">Botanical Emerald Operations</option>
                  <option value="indigo">Regal Indigo Specialist</option>
                  <option value="slate">Warm Charcoal Diplomatic</option>
                </select>
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2.5 text-sm text-[#1C1917] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={verifiedByStaff}
                    onChange={(e) => setVerifiedByStaff(e.target.checked)}
                    className="w-4 h-4 rounded border-[#D6D3CD] text-[#1D4ED8] focus:ring-[#1D4ED8]"
                  />
                  <span className="font-medium">
                    Credentials Verified by Authorized Staff
                  </span>
                </label>
              </div>
            </div>

            {/* Assigned Delegates Summary */}
            <div className="pt-4 border-t border-[#E6E4DD]">
              <div className="text-xs font-semibold text-[#57534E] mb-2">
                Assigned Delegates ({assignedDelegates.length})
              </div>
              {assignedDelegates.length === 0 ? (
                <p className="text-xs text-[#78716C]">
                  No delegates currently assigned to this officer.
                </p>
              ) : (
                <div className="space-y-2">
                  {assignedDelegates.map((d) => (
                    <div
                      key={d.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs py-2 px-3.5 bg-[#F7F6F2] border border-[#E6E4DD] rounded-lg"
                    >
                      <span className="font-semibold text-[#1C1917]">
                        {d.delegateName} ({d.company})
                      </span>
                      <span className="text-[#57534E] font-mono tabular-nums">
                        Arr: {d.arrivalFlight} [{d.pickupStatus}] · Hotel:{' '}
                        {d.hotelName}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#E6E4DD]">
              <button
                type="button"
                onClick={() =>
                  exportIndividualLoPdf(
                    officer,
                    {
                      id: 'primary',
                      ownerId: currentUserId || 'demo-operator',
                      officerId: officer.id,
                      contactNumber,
                      idDocumentType,
                      idDocumentNumber,
                      signatureText,
                      photoStyle,
                      verifiedByStaff,
                    },
                    allOfficers,
                    delegates
                  )
                }
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#14213D] bg-[#F7F6F2] border border-[#D6D3CD] rounded-lg hover:bg-[#E6E4DD]/60 transition-colors whitespace-nowrap shrink-0"
              >
                <FileDown className="w-4 h-4" />
                Download Officer PDF Profile
              </button>

              <div className="flex items-center gap-3">
                {savedNotice && (
                  <span className="text-xs text-[#047857] font-semibold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Saved
                  </span>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-[#57534E] border border-[#D6D3CD] rounded-lg hover:bg-[#F7F6F2] transition-colors whitespace-nowrap shrink-0"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2.5 text-xs font-semibold text-white bg-[#1D4ED8] rounded-lg hover:bg-[#1E40AF] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
                >
                  {saving ? 'Saving...' : 'Save Credentials'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
