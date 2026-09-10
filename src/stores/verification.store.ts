import * as kycService from "@/services/kyc.service";
import { create } from "zustand";

// ─── Types ──────────────────────────────────────────────────

export interface BasicInfoData {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  dateOfBirth: string;
  gender: string;
  civilStatus: string;
  educationLevel: string;
  country: string;
  countryCode: string;
  region: string;
  regionCode: string;
  province: string;
  provinceCode: string;
  cityTown: string;
  cityCode: string;
  barangay: string;
  barangayCode: string;
}

export interface ContactInfoData {
  contactNumber: string;
  secondaryEmail: string;
}

export interface IdDocumentsData {
  idType: string;
  frontUri: string | null;
  backUri: string | null;
  signatureUri: string | null;
  proofOfIncomeUri: string | null;
  proofOfAddressUri: string | null;
  faceUri: string | null;
}

type VerificationState = {
  isVerified: boolean;
  kycStatus: string | null; // 'VERIFIED' | 'PENDING_KYC' | 'APPROVED' | 'REJECTED' etc.
  // Why verification failed, in words the borrower can act on. Set by the backend.
  kycRejectionReason: string | null;

  // Form data persisted across verification screens
  basicInfo: BasicInfoData;
  contactInfo: ContactInfoData;
  idDocuments: IdDocumentsData;

  // Face match result (set after FaceRecognition screen)
  faceMatchPassed: boolean | null;
  faceMatchScore: number | null;

  // Actions
  markVerified: () => void;
  resetVerification: () => void;
  setKycStatus: (status: string) => void;
  checkKycStatus: () => Promise<void>;
  setBasicInfo: (data: BasicInfoData) => void;
  setContactInfo: (data: ContactInfoData) => void;
  setIdDocuments: (data: Partial<IdDocumentsData>) => void;
  setFaceMatchResult: (passed: boolean, score: number) => void;
  resetFormData: () => void;
};

const initialBasicInfo: BasicInfoData = {
  firstName: "",
  middleName: "",
  lastName: "",
  dateOfBirth: "",
  gender: "",
  civilStatus: "",
  educationLevel: "",
  country: "",
  countryCode: "",
  region: "",
  regionCode: "",
  province: "",
  provinceCode: "",
  cityTown: "",
  cityCode: "",
  barangay: "",
  barangayCode: "",
};

const initialContactInfo: ContactInfoData = {
  contactNumber: "",
  secondaryEmail: "",
};

const initialIdDocuments: IdDocumentsData = {
  idType: "",
  frontUri: null,
  backUri: null,
  signatureUri: null,
  proofOfIncomeUri: null,
  proofOfAddressUri: null,
  faceUri: null,
};

export const useVerificationStore = create<VerificationState>((set) => ({
  isVerified: false,
  kycStatus: null,
  kycRejectionReason: null,

  basicInfo: { ...initialBasicInfo },
  contactInfo: { ...initialContactInfo },
  idDocuments: { ...initialIdDocuments },

  faceMatchPassed: null,
  faceMatchScore: null,

  markVerified: () => set({ isVerified: true, kycStatus: "APPROVED", kycRejectionReason: null }),
  resetVerification: () =>
    set({
      isVerified: false,
      kycStatus: null,
      kycRejectionReason: null,
    }),
  setKycStatus: (status) =>
    set({
      kycStatus: status,
      isVerified: status === "APPROVED" || status === "CONNECTED",
    }),
  checkKycStatus: async () => {
    try {
      const result = await kycService.getKycStatus();
      if (result.success && result.data) {
        const status = result.data.status;
        set({
          kycStatus: status,
          kycRejectionReason: result.data.rejectionReason ?? null,
          isVerified: status === "APPROVED" || status === "CONNECTED",
        });
      }
    } catch {
      // Keep current state on error
    }
  },
  setBasicInfo: (data) => set({ basicInfo: data }),
  setContactInfo: (data) => set({ contactInfo: data }),
  setIdDocuments: (data) =>
    set((state) => ({
      idDocuments: { ...state.idDocuments, ...data },
    })),
  setFaceMatchResult: (passed, score) =>
    set({ faceMatchPassed: passed, faceMatchScore: score }),
  resetFormData: () =>
    set({
      basicInfo: { ...initialBasicInfo },
      contactInfo: { ...initialContactInfo },
      idDocuments: { ...initialIdDocuments },
      faceMatchPassed: null,
      faceMatchScore: null,
    }),
}));
