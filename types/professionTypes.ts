// ══════════════════════════════════════════
// TYPES : Professions & Profils
// ══════════════════════════════════════════

// --- Catégories de métiers ---
export type ProfessionCategory = 'education' | 'liberal';

// --- Profil utilisateur enrichi ---
export interface UserProfile {
  uid: string;
  profession: string;              // 'teacher' | 'expert_foncier'
  category: ProfessionCategory;
  displayName: string;
  country: string;
  onboardingComplete: boolean;
  createdAt: string;
  professionData: Record<string, any>;
}

// --- Données spécifiques : Enseignant ---
export interface TeacherData {
  establishment: string;
  level: 'primaire' | 'cem' | 'lycee' | 'universitaire';
  subject: string;
  classes: string[];               // ["3AS", "2AS", "1AS"]
}

// --- Données spécifiques : Expert ---
export interface ExpertData {
  specialty: 'foncier' | 'batiment' | 'comptable' | 'automobile' | 'autre';
  cabinetName: string;
  tableNumber: string;
  phone: string;
  address: string;
  professionalEmail: string;
  savedReportModels: ReportModel[];
}

export interface ReportModel {
  id: string;
  name: string;
  uploadedAt: string;
  fileBase64: string;              // PDF modèle stocké chiffré
  fileIv: number[];
}

// --- Configuration d'un champ du questionnaire ---
export interface OnboardingField {
  id: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'select' | 'chips' | 'cards';
  placeholder?: string;
  options?: { value: string; label: string; icon?: string }[];
  required?: boolean;
}

export interface OnboardingStep {
  title: string;
  subtitle?: string;
  fields: OnboardingField[];
}

// --- Action sur la Home ---
export interface HomeAction {
  id: string;
  label: string;
  icon: string;                    // nom d'icône Lucide
  description?: string;
  flowType: 'scan' | 'creation';
  route?: string;                  // route spécifique (ex: '/report-builder')
  scanType?: string;               // type pré-rempli pour le flow scan
  comingSoon?: boolean;
}

// --- Configuration complète d'une profession ---
export interface ProfessionConfig {
  id: string;
  category: ProfessionCategory;
  label: string;
  labelShort: string;              // Affiché dans le header Home
  icon: string;                    // nom Lucide
  color: string;                   // Couleur thème hex
  gradient: [string, string];      // Dégradé de la carte onboarding
  onboardingSteps: OnboardingStep[];
  scanActions: HomeAction[];
  creationActions: HomeAction[];
  comingSoon?: boolean;
}
