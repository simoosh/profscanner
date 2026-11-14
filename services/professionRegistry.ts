import type { ProfessionConfig } from '../types/professionTypes';

// ══════════════════════════════════════════════════════════════
// REGISTRE DES PROFESSIONS
// Pour ajouter un métier : ajouter un objet ProfessionConfig ici.
// ══════════════════════════════════════════════════════════════

const PROFESSIONS: ProfessionConfig[] = [

  // ─────────────────────────────────────
  // ENSEIGNANT
  // ─────────────────────────────────────
  {
    id: 'teacher',
    category: 'education',
    label: 'Enseignant',
    labelShort: 'Enseignant',
    icon: 'GraduationCap',
    color: '#3b82f6',
    gradient: ['#3b82f6', '#1d4ed8'],

    onboardingSteps: [
      {
        title: 'Votre établissement',
        subtitle: 'Ces informations serviront à pré-remplir vos documents',
        fields: [
          { id: 'establishment', label: 'Nom de l\'établissement', type: 'text', placeholder: 'Lycée Amirouche...', required: true },
          { id: 'country', label: 'Pays', type: 'select', required: true, options: [
            { value: 'dz', label: 'Algérie' },
            { value: 'ma', label: 'Maroc' },
            { value: 'tn', label: 'Tunisie' },
            { value: 'fr', label: 'France' },
            { value: 'other', label: 'Autre' },
          ]},
        ],
      },
      {
        title: 'Niveau d\'enseignement',
        fields: [
          { id: 'level', label: 'Niveau', type: 'cards', required: true, options: [
            { value: 'primaire', label: 'Primaire', icon: 'BookOpen' },
            { value: 'cem', label: 'CEM / Collège', icon: 'School' },
            { value: 'lycee', label: 'Lycée', icon: 'GraduationCap' },
            { value: 'universitaire', label: 'Université', icon: 'Building2' },
          ]},
        ],
      },
      {
        title: 'Votre matière',
        fields: [
          { id: 'subject', label: 'Matière enseignée', type: 'text', placeholder: 'Mathématiques, Physique...', required: true },
        ],
      },
      {
        title: 'Vos classes',
        subtitle: 'Vous pourrez les modifier chaque année depuis votre profil',
        fields: [
          { id: 'classes', label: 'Classes', type: 'chips', placeholder: 'Tapez une classe + Entrée (ex: 3AS1)' },
        ],
      },
    ],

    scanActions: [
      { id: 'scan_photo', label: 'Prendre en photo', icon: 'Camera', flowType: 'scan' },
      { id: 'scan_import', label: 'Importer', icon: 'Upload', flowType: 'scan' },
      { id: 'scan_exam', label: 'Examen', icon: 'FileCheck', flowType: 'scan', scanType: 'exam' },
      { id: 'scan_course', label: 'Cours', icon: 'BookOpen', flowType: 'scan', scanType: 'course' },
      { id: 'scan_quiz', label: 'Interro', icon: 'ClipboardList', flowType: 'scan', scanType: 'quiz' },
      { id: 'scan_homework', label: 'Devoir', icon: 'PenTool', flowType: 'scan', scanType: 'homework' },
      { id: 'scan_td', label: 'Série de TD', icon: 'Layers', flowType: 'scan', scanType: 'td_series' },
    ],

    creationActions: [
      { id: 'create_exam', label: 'Sujet d\'examen', icon: 'FileCheck', flowType: 'creation', description: 'Générer un sujet d\'examen complet' },
      { id: 'create_course', label: 'Cours', icon: 'BookOpen', flowType: 'creation', description: 'Créer un cours structuré' },
      { id: 'create_summary', label: 'Résumé', icon: 'FileText', flowType: 'creation', description: 'Résumer un cours ou chapitre' },
      { id: 'create_exercises', label: 'Série d\'exercices', icon: 'Layers', flowType: 'creation', description: 'Générer des exercices avec solutions' },
    ],
  },

  // ─────────────────────────────────────
  // EXPERT FONCIER / JUDICIAIRE
  // ─────────────────────────────────────
  {
    id: 'expert_foncier',
    category: 'liberal',
    label: 'Expert foncier / judiciaire',
    labelShort: 'Expert judiciaire',
    icon: 'Scale',
    color: '#059669',
    gradient: ['#059669', '#047857'],

    onboardingSteps: [
      {
        title: 'Votre spécialité',
        fields: [
          { id: 'specialty', label: 'Type d\'expertise', type: 'cards', required: true, options: [
            { value: 'foncier', label: 'Foncier', icon: 'MapPin' },
            { value: 'batiment', label: 'Bâtiment', icon: 'Building' },
            { value: 'comptable', label: 'Comptable', icon: 'Calculator' },
            { value: 'automobile', label: 'Automobile', icon: 'Car' },
            { value: 'autre', label: 'Autre', icon: 'Briefcase' },
          ]},
        ],
      },
      {
        title: 'Votre cabinet',
        fields: [
          { id: 'cabinetName', label: 'Nom du cabinet / bureau', type: 'text', placeholder: 'Cabinet d\'expertise...', required: true },
          { id: 'tableNumber', label: 'Numéro du tableau', type: 'text', placeholder: 'Ex: 1234' },
          { id: 'country', label: 'Pays', type: 'select', required: true, options: [
            { value: 'dz', label: 'Algérie' },
            { value: 'ma', label: 'Maroc' },
            { value: 'tn', label: 'Tunisie' },
            { value: 'fr', label: 'France' },
            { value: 'other', label: 'Autre' },
          ]},
        ],
      },
      {
        title: 'Vos coordonnées professionnelles',
        subtitle: 'Utilisées pour l\'en-tête de vos rapports',
        fields: [
          { id: 'phone', label: 'Téléphone', type: 'tel', placeholder: '0770 123 456' },
          { id: 'address', label: 'Adresse professionnelle', type: 'text', placeholder: 'Rue, Ville, Wilaya' },
          { id: 'professionalEmail', label: 'Email professionnel', type: 'email', placeholder: 'expert@cabinet.com' },
        ],
      },
    ],

    scanActions: [
      { id: 'scan_photo', label: 'Prendre en photo', icon: 'Camera', flowType: 'scan' },
      { id: 'scan_import', label: 'Importer', icon: 'Upload', flowType: 'scan' },
    ],

    creationActions: [
      { id: 'create_report_jud_partial', label: 'Rapport judiciaire (à compléter)', icon: 'FileSearch', flowType: 'creation', description: 'Swap les infos du modèle sans analyse', route: '/report-builder' },
      { id: 'create_report_jud_full', label: 'Rapport judiciaire (fini)', icon: 'FileCheck2', flowType: 'creation', description: 'L\'IA répond aux missions du jugement', route: '/report-builder' },
      { id: 'create_report_priv_partial', label: 'Rapport privé (à compléter)', icon: 'FileLock', flowType: 'creation', description: 'Rapport privé — données swappées', route: '/report-builder' },
      { id: 'create_report_priv_full', label: 'Rapport privé (fini)', icon: 'FileLock2', flowType: 'creation', description: 'Rapport privé — IA complète tout', route: '/report-builder' },
      { id: 'create_courrier', label: 'Courriel', icon: 'Mail', flowType: 'creation', description: 'Convocation, demande, etc.' },
      { id: 'create_pv', label: 'PV', icon: 'ClipboardCheck', flowType: 'creation', description: 'Procès-verbal' },
    ],
  },

  // ─────────────────────────────────────
  // PLACEHOLDERS (coming soon)
  // ─────────────────────────────────────
  {
    id: 'doctor',
    category: 'liberal',
    label: 'Médecin',
    labelShort: 'Médecin',
    icon: 'Stethoscope',
    color: '#dc2626',
    gradient: ['#dc2626', '#b91c1c'],
    onboardingSteps: [],
    scanActions: [],
    creationActions: [],
    comingSoon: true,
  },
  {
    id: 'lawyer',
    category: 'liberal',
    label: 'Avocat',
    labelShort: 'Avocat',
    icon: 'Gavel',
    color: '#7c3aed',
    gradient: ['#7c3aed', '#6d28d9'],
    onboardingSteps: [],
    scanActions: [],
    creationActions: [],
    comingSoon: true,
  },
  {
    id: 'architect',
    category: 'liberal',
    label: 'Architecte',
    labelShort: 'Architecte',
    icon: 'Ruler',
    color: '#ea580c',
    gradient: ['#ea580c', '#c2410c'],
    onboardingSteps: [],
    scanActions: [],
    creationActions: [],
    comingSoon: true,
  },
];

// ══════════════════════════════════════════════════════════════
// API PUBLIQUE
// ══════════════════════════════════════════════════════════════

/** Toutes les professions disponibles */
export const getAllProfessions = (): ProfessionConfig[] => PROFESSIONS;

/** Professions actives (pas "coming soon") */
export const getActiveProfessions = (): ProfessionConfig[] =>
  PROFESSIONS.filter(p => !p.comingSoon);

/** Récupérer une profession par son ID */
export const getProfessionById = (id: string): ProfessionConfig | undefined =>
  PROFESSIONS.find(p => p.id === id);

/** Professions "coming soon" */
export const getComingSoonProfessions = (): ProfessionConfig[] =>
  PROFESSIONS.filter(p => p.comingSoon);
