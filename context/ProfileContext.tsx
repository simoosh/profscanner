import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import type { UserProfile } from '../types/professionTypes';

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
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      const profileRef = doc(db, 'users', user.uid, 'settings', 'profile');
      const snap = await getDoc(profileRef);

      if (snap.exists()) {
        setProfile(snap.data() as UserProfile);
      } else {
        setProfile(null);
      }
    } catch (e) {
      console.error('Erreur chargement profil:', e);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const saveProfile = async (newProfile: UserProfile) => {
    if (!user) throw new Error('Non connecté');

    const profileRef = doc(db, 'users', user.uid, 'settings', 'profile');
    await setDoc(profileRef, newProfile);
    setProfile(newProfile);
  };

  const updateProfessionData = async (data: Record<string, any>) => {
    if (!user || !profile) throw new Error('Pas de profil');

    const profileRef = doc(db, 'users', user.uid, 'settings', 'profile');
    const updatedData = { ...profile.professionData, ...data };
    await updateDoc(profileRef, { professionData: updatedData });
    setProfile(prev => prev ? { ...prev, professionData: updatedData } : null);
  };

  const refreshProfile = async () => {
    setLoading(true);
    await loadProfile();
  };

  const isOnboarded = profile?.onboardingComplete === true;

  return (
    <ProfileContext.Provider value={{
      profile,
      loading,
      isOnboarded,
      saveProfile,
      updateProfessionData,
      refreshProfile,
    }}>
      {children}
    </ProfileContext.Provider>
  );
};
