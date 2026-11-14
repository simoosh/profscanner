import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../context/ProfileContext';
import { getAllProfessions } from '../services/professionRegistry';
import type { ProfessionConfig, OnboardingField, UserProfile } from '../types/professionTypes';
import {
  GraduationCap, Scale, Stethoscope, Ruler, Briefcase,
  BookOpen, School, Building2, MapPin, Building, Calculator, Car,
  ChevronLeft, Check, Sparkles, Lock,
  ArrowRight,
} from 'lucide-react';

// ══════════════════════════════════════════
// MAP icône Lucide par nom -> composant
// ══════════════════════════════════════════
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ICON_MAP: Record<string, any> = {
  GraduationCap, Scale, Stethoscope, Ruler, Briefcase,
  BookOpen, School, Building2, MapPin, Building, Calculator, Car,
};

const getIcon = (name: string, size = 28, className = '') => {
  const Icon = ICON_MAP[name];
  return Icon ? <Icon size={size} className={className} /> : <Briefcase size={size} className={className} />;
};

// ══════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ══════════════════════════════════════════
const Onboarding: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { saveProfile } = useProfile();

  const allProfessions = useMemo(() => getAllProfessions(), []);


  // État du wizard
  const [step, setStep] = useState(0);
  // step 0 = choix métier
  // step 1 = nom complet
  // step 2+ = questions spécifiques au métier
  // dernier = écran de succès

  const [selectedProfession, setSelectedProfession] = useState<ProfessionConfig | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [cardDirection, setCardDirection] = useState<'left' | 'right'>('right');
  const [chipInput, setChipInput] = useState('');

  // Calculs
  const professionSteps = selectedProfession?.onboardingSteps || [];
  const totalSteps = 2 + professionSteps.length; // métier + nom + spécifiques
  const isLastStep = step === totalSteps;
  const progress = Math.min(((step) / totalSteps) * 100, 100);

  // ── Sélection profession ──
  const handleSelectProfession = (prof: ProfessionConfig) => {
    if (prof.comingSoon) return;
    
    if (selectedProfession && selectedProfession.id !== prof.id) {
      const oldIndex = allProfessions.findIndex(p => p.id === selectedProfession.id);
      const newIndex = allProfessions.findIndex(p => p.id === prof.id);
      setCardDirection(newIndex > oldIndex ? 'right' : 'left');
    }
    
    setSelectedProfession(prof);
    setFormData({});
  };

  // ── Navigation ──
  const canAdvance = () => {
    if (step === 0) return !!selectedProfession;
    if (step === 1) return displayName.trim().length > 0;
    
    // Vérifier les champs requis de l'étape courante
    const stepConfig = professionSteps[step - 2];
    if (!stepConfig) return true;
    
    return stepConfig.fields
      .filter(f => f.required)
      .every(f => {
        const val = formData[f.id];
        if (Array.isArray(val)) return val.length > 0;
        return val && String(val).trim().length > 0;
      });
  };

  const handleNext = () => {
    if (!canAdvance()) return;
    setStep(s => s + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(s => s - 1);
  };

  // ── Sauvegarde finale ──
  const handleFinish = async () => {
    if (!user || !selectedProfession || saving) return;
    setSaving(true);

    try {
      // Séparer country du reste des professionData
      const { country, ...restData } = formData;

      const profile: UserProfile = {
        uid: user.uid,
        profession: selectedProfession.id,
        category: selectedProfession.category,
        displayName: displayName.trim(),
        country: country || formData.country || '',
        onboardingComplete: true,
        createdAt: new Date().toISOString(),
        professionData: restData,
      };

      await saveProfile(profile);
      
      // Petit délai pour voir l'animation de succès
      setTimeout(() => navigate('/', { replace: true }), 1500);
    } catch (e) {
      console.error('Erreur sauvegarde profil:', e);
      setSaving(false);
    }
  };

  // ── Mise à jour d'un champ ──
  const updateField = (fieldId: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
  };

  // ── Ajout d'un chip ──
  const handleChipKeyDown = (fieldId: string, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && chipInput.trim()) {
      e.preventDefault();
      const current = formData[fieldId] || [];
      if (!current.includes(chipInput.trim())) {
        updateField(fieldId, [...current, chipInput.trim()]);
      }
      setChipInput('');
    }
  };

  const removeChip = (fieldId: string, index: number) => {
    const current = formData[fieldId] || [];
    updateField(fieldId, current.filter((_: string, i: number) => i !== index));
  };

  // ══════════════════════════════════════════
  // RENDER D'UN CHAMP
  // ══════════════════════════════════════════
  const renderField = (field: OnboardingField) => {
    switch (field.type) {
      case 'text':
      case 'email':
      case 'tel':
        return (
          <div key={field.id} className="mb-4">
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">{field.label}</label>
            <input
              type={field.type}
              value={formData[field.id] || ''}
              onChange={e => updateField(field.id, e.target.value)}
              placeholder={field.placeholder}
              className="w-full p-3.5 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            />
          </div>
        );

      case 'select':
        return (
          <div key={field.id} className="mb-4">
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">{field.label}</label>
            <select
              value={formData[field.id] || ''}
              onChange={e => updateField(field.id, e.target.value)}
              className="w-full p-3.5 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none"
            >
              <option value="">Sélectionner...</option>
              {field.options?.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        );

      case 'cards':
        return (
          <div key={field.id} className="mb-4">
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">{field.label}</label>
            <div className="grid grid-cols-2 gap-3">
              {field.options?.map(opt => {
                const isSelected = formData[field.id] === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => updateField(field.id, opt.value)}
                    className={`p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 shadow-lg shadow-blue-500/20'
                        : 'border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {opt.icon && getIcon(opt.icon, 20, isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400')}
                    </div>
                    <p className={`font-semibold text-sm ${isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>
                      {opt.label}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 'chips':
        return (
          <div key={field.id} className="mb-4">
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">{field.label}</label>
            
            {/* Chips existantes */}
            <div className="flex flex-wrap gap-2 mb-3">
              {(formData[field.id] || []).map((chip: string, i: number) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium"
                >
                  {chip}
                  <button
                    onClick={() => removeChip(field.id, i)}
                    className="ml-1 text-blue-400 hover:text-red-500 transition-colors"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>

            {/* Input pour ajouter */}
            <input
              type="text"
              value={chipInput}
              onChange={e => setChipInput(e.target.value)}
              onKeyDown={e => handleChipKeyDown(field.id, e)}
              placeholder={field.placeholder}
              className="w-full p-3.5 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
        );

      default:
        return null;
    }
  };

  // ══════════════════════════════════════════
  // RENDER PRINCIPAL
  // ══════════════════════════════════════════

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-slate-900 dark:to-slate-800 flex flex-col transition-colors">

      {/* ── Barre de progression ── */}
      <div className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-gray-100 dark:border-slate-700">
        <div className="h-1 bg-gray-200 dark:bg-slate-700">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500 ease-out rounded-r-full"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="px-4 py-3 flex items-center justify-between">
          {step > 0 ? (
            <button onClick={handleBack} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-gray-400 transition-colors">
              <ChevronLeft size={24} />
            </button>
          ) : <div className="w-10" />}
          <span className="text-sm font-medium text-gray-400 dark:text-gray-500">
            {step === 0 ? '' : `${step} / ${totalSteps}`}
          </span>
          <div className="w-10" />
        </div>
      </div>

      {/* ── Contenu ── */}
      <div className="flex-1 flex flex-col px-5 py-6 overflow-y-auto">

        {/* ═══ ÉTAPE 0 : CHOIX DU MÉTIER ═══ */}
        {step === 0 && (
          <div className="flex-1 flex flex-col animate-slide-up">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Bienvenue sur SecretarIA
              </h1>
              <p className="text-gray-500 dark:text-gray-400">
                Quelle est votre profession ?
              </p>
            </div>

            {/* Carte animée du métier sélectionné */}
            {selectedProfession && !selectedProfession.comingSoon && (
              <div className="flex justify-center mb-8">
                <div
                  key={selectedProfession.id}
                  className={`onboarding-card-active ${cardDirection === 'right' ? 'card-enter-right' : 'card-enter-left'}`}
                  style={{
                    background: `linear-gradient(135deg, ${selectedProfession.gradient[0]}, ${selectedProfession.gradient[1]})`,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm">
                      {getIcon(selectedProfession.icon, 32, 'text-white')}
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-lg">{selectedProfession.label}</h3>
                      <p className="text-white/70 text-sm">
                        {selectedProfession.category === 'education' ? 'Éducation' : 'Profession libérale'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Grille de sélection */}
            <div className="grid grid-cols-2 gap-3">
              {allProfessions.map(prof => {
                const isSelected = selectedProfession?.id === prof.id;
                const isSoon = prof.comingSoon;
                return (
                  <button
                    key={prof.id}
                    onClick={() => handleSelectProfession(prof)}
                    disabled={isSoon}
                    className={`relative p-4 rounded-2xl border-2 text-left transition-all duration-300 ${
                      isSoon
                        ? 'opacity-50 cursor-not-allowed border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800'
                        : isSelected
                          ? 'border-transparent ring-2 ring-offset-2 dark:ring-offset-slate-900 bg-white dark:bg-slate-700 shadow-lg'
                          : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-md hover:border-gray-300'
                    }`}
                    style={isSelected ? { boxShadow: `0 0 0 2px ${prof.color}` } : {}}
                  >
                    {isSoon && (
                      <span className="absolute top-2 right-2 bg-gray-200 dark:bg-slate-600 text-gray-500 dark:text-gray-400 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Lock size={10} /> Bientôt
                      </span>
                    )}
                    <div className="mb-2" style={{ color: prof.color }}>
                      {getIcon(prof.icon, 24)}
                    </div>
                    <p className={`font-semibold text-sm ${isSelected ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}>
                      {prof.label}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══ ÉTAPE 1 : NOM COMPLET ═══ */}
        {step === 1 && (
          <div className="flex-1 flex flex-col animate-slide-up">
            <div className="text-center mb-8">
              <div
                className="inline-flex p-3 rounded-2xl mb-4"
                style={{ backgroundColor: `${selectedProfession?.color}15` }}
              >
                {selectedProfession && getIcon(selectedProfession.icon, 32, '')}
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Comment vous appelez-vous ?
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Ce nom apparaîtra sur vos documents générés
              </p>
            </div>

            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Votre nom complet"
              autoFocus
              className="w-full p-4 bg-white dark:bg-slate-700 border-2 border-gray-200 dark:border-slate-600 rounded-2xl text-gray-900 dark:text-white text-lg placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-center font-medium"
            />
          </div>
        )}

        {/* ═══ ÉTAPES 2+ : QUESTIONS SPÉCIFIQUES ═══ */}
        {step >= 2 && step < totalSteps && professionSteps[step - 2] && (
          <div key={step} className="flex-1 flex flex-col animate-slide-up">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {professionSteps[step - 2].title}
              </h1>
              {professionSteps[step - 2].subtitle && (
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  {professionSteps[step - 2].subtitle}
                </p>
              )}
            </div>

            {professionSteps[step - 2].fields.map(renderField)}
          </div>
        )}

        {/* ═══ DERNIER ÉCRAN : SUCCÈS ═══ */}
        {isLastStep && (
          <div className="flex-1 flex flex-col items-center justify-center animate-slide-up">
            <div className="onboarding-success-check mb-6">
              <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center shadow-xl shadow-green-500/30">
                <Check size={40} className="text-white" strokeWidth={3} />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 text-center">
              Votre espace est prêt !
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-center mb-8">
              {selectedProfession?.label} &mdash; {displayName}
            </p>

            <button
              onClick={handleFinish}
              disabled={saving}
              className="w-full max-w-xs bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-500/30 transition-all active:scale-[0.97] flex items-center justify-center gap-2"
            >
              {saving ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Sparkles size={20} />
                  Commencer
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* ── Bouton Continuer (pas sur le dernier écran) ── */}
      {!isLastStep && (
        <div className="sticky bottom-0 p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-t border-gray-100 dark:border-slate-700">
          <button
            onClick={handleNext}
            disabled={!canAdvance()}
            className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all duration-300 ${
              canAdvance()
                ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 active:scale-[0.97]'
                : 'bg-gray-200 dark:bg-slate-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
            }`}
          >
            Continuer
            <ArrowRight size={20} />
          </button>
        </div>
      )}
    </div>
  );
};

export default Onboarding;
