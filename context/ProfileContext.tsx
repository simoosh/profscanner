import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { appStore } from '../services/storage';
import type { UserProfile } from '../types/professionTypes';

// Le profil est stocké uniquement sur l'appareil (IndexedDB).
const PROFILE_KEY = 'profile';

interface ProfileContextType {
  profile: UserProfile | null;
  loading: boolean;
  isOnboarded: boolean;
  saveProfile: (profile: UserProfile) => Promise<void>;
  updateProfessionData: (data: Record<string, any>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType>({} as ProfileContextType);

export const useProfile = () => useContext(ProfileContext);

export const ProfileProvider = ({ children }: { children: React.ReactNode }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    try {
      setProfile((await appStore.getItem<UserProfile>(PROFILE_KEY)) ?? null);
    } catch (e) {
      console.error('Erreur chargement profil:', e);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const saveProfile = async (newProfile: UserProfile) => {
    await appStore.setItem(PROFILE_KEY, newProfile);
    setProfile(newProfile);
  };

  const updateProfessionData = async (data: Record<string, any>) => {
    if (!profile) throw new Error('Pas de profil');
    const updated = { ...profile, professionData: { ...profile.professionData, ...data } };
    await appStore.setItem(PROFILE_KEY, updated);
    setProfile(updated);
  };

  const refreshProfile = async () => {
    setLoading(true);
    await loadProfile();
  };

  const isOnboarded = profile?.onboardingComplete === true;

  return (
    <ProfileContext.Provider
      value={{ profile, loading, isOnboarded, saveProfile, updateProfessionData, refreshProfile }}
    >
      {children}
    </ProfileContext.Provider>
  );
};
