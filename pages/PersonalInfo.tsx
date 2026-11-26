import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, User, Briefcase, HardDrive } from 'lucide-react';
import { useProfile } from '../context/ProfileContext';
import { getProfessionById } from '../services/professionRegistry';
import { ApiService } from '../services/apiService';

const formatValue = (value: unknown): string => {
  if (Array.isArray(value)) return value.join(', ');
  if (value === null || value === undefined) return '';
  return String(value);
};

const PersonalInfo: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const [scanCount, setScanCount] = useState<number | null>(null);

  const profession = useMemo(
    () => (profile?.profession ? getProfessionById(profile.profession) : undefined),
    [profile?.profession]
  );

  // Libellés des champs du questionnaire d'onboarding, pour afficher les réponses.
  const fields = useMemo(() => {
    if (!profession || !profile) return [];
    const labels = new Map<string, { label: string; options?: { value: string; label: string }[] }>();
    profession.onboardingSteps.forEach((step) =>
      step.fields.forEach((field) => labels.set(field.id, { label: field.label, options: field.options }))
    );
    const data: Record<string, unknown> = { ...profile.professionData, country: profile.country };
    return Object.entries(data)
      .filter(([key, value]) => labels.has(key) && formatValue(value))
      .map(([key, value]) => {
        const { label, options } = labels.get(key)!;
        const display = Array.isArray(value)
          ? value.map((v) => options?.find((o) => o.value === v)?.label || v).join(', ')
          : options?.find((o) => o.value === value)?.label || formatValue(value);
        return { key, label, value: display };
      });
  }, [profession, profile]);

  useEffect(() => {
    ApiService.getHistory()
      .then((history) => setScanCount(history.length))
      .catch(() => setScanCount(0));
  }, []);

  return (
    <div className="min-h-dvh bg-gray-50 dark:bg-slate-900 transition-colors duration-300 pb-20">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 p-4 shadow-sm flex items-center gap-3 sticky top-0 z-10 transition-colors border-b dark:border-slate-700">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-200 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white transition-colors">Infos Personnelles</h1>
      </div>

      <div className="p-4 space-y-6 max-w-2xl mx-auto">
        {/* Identité */}
        <section>
          <h2 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 ml-1">Identité</h2>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden transition-colors">
            <div className="p-5 border-b border-gray-50 dark:border-slate-700">
              <div className="flex items-center gap-3 mb-2">
                <User className="w-5 h-5 text-blue-500" />
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Nom</span>
              </div>
              <p dir="auto" className="text-lg font-semibold text-gray-900 dark:text-white pl-8 break-words">
                {profile?.displayName || '—'}
              </p>
            </div>
            <div className="p-5">
              <div className="flex items-center gap-3 mb-2">
                <Briefcase className="w-5 h-5 text-green-500" />
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Métier</span>
              </div>
              <p className="text-lg font-semibold text-gray-900 dark:text-white pl-8">{profession?.label || '—'}</p>
            </div>
          </div>
        </section>

        {/* Réponses du questionnaire */}
        {fields.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 ml-1">Informations professionnelles</h2>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden transition-colors">
              {fields.map((field, index) => (
                <div key={field.key} className={`p-4 ${index < fields.length - 1 ? 'border-b border-gray-50 dark:border-slate-700' : ''}`}>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{field.label}</p>
                  <p dir="auto" className="font-semibold text-gray-900 dark:text-white break-words">{field.value}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Statistiques */}
        <section>
          <h2 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 ml-1">Statistiques</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 transition-colors">
              <div className="flex items-center gap-2 mb-3 text-purple-600 dark:text-purple-400">
                <FileText size={20} />
                <span className="font-semibold text-sm">Scans enregistrés</span>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{scanCount === null ? '...' : scanCount}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 transition-colors">
              <div className="flex items-center gap-2 mb-3 text-teal-600 dark:text-teal-400">
                <HardDrive size={20} />
                <span className="font-semibold text-sm">Stockage</span>
              </div>
              <p className="text-base font-bold text-gray-900 dark:text-white">Sur cet appareil</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default PersonalInfo;
