// Generic cancer profile registry for MRT
// Goal: decouple UI/research logic from bladder-specific assumptions.

export const CANCER_PROFILES = {
  urothelial_carcinoma: {
    id: 'urothelial_carcinoma',
    label: 'Urothelial Carcinoma',
    aliases: ['bladder cancer', 'urothelial cancer', 'mibc', 'muc'],
    keyBiomarkers: ['FGFR3', 'ERBB2', 'NECTIN4', 'PD-L1', 'TMB', 'ctDNA'],
    commonReportSources: ['FoundationOne', 'Tempus', 'Caris', 'Guardant'],
  },
  breast_cancer: {
    id: 'breast_cancer',
    label: 'Breast Cancer',
    aliases: ['breast carcinoma'],
    keyBiomarkers: ['ER', 'PR', 'HER2', 'PIK3CA', 'ESR1', 'BRCA1', 'BRCA2'],
    commonReportSources: ['FoundationOne', 'Tempus', 'Caris', 'Guardant'],
  },
  lung_nsclc: {
    id: 'lung_nsclc',
    label: 'Lung Cancer (NSCLC)',
    aliases: ['nsclc', 'non-small cell lung cancer'],
    keyBiomarkers: ['EGFR', 'ALK', 'ROS1', 'BRAF', 'KRAS', 'MET', 'RET', 'PD-L1'],
    commonReportSources: ['FoundationOne', 'Tempus', 'Caris', 'Guardant'],
  },
  colorectal_cancer: {
    id: 'colorectal_cancer',
    label: 'Colorectal Cancer',
    aliases: ['crc', 'colon cancer', 'rectal cancer'],
    keyBiomarkers: ['KRAS', 'NRAS', 'BRAF', 'MSI', 'TMB', 'HER2'],
    commonReportSources: ['FoundationOne', 'Tempus', 'Caris', 'Guardant'],
  },
};

export function getCancerProfile(profileId) {
  return CANCER_PROFILES[profileId] || null;
}

export function listCancerProfiles() {
  return Object.values(CANCER_PROFILES).map((p) => ({ id: p.id, label: p.label }));
}
