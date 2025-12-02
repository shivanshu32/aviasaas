import { createContext, useContext, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { clinicService } from '../services/clinicService';

const ClinicContext = createContext(null);

export function ClinicProvider({ children }) {
  // Fetch clinic settings
  const { data: settingsData, isLoading } = useQuery({
    queryKey: ['clinicSettings'],
    queryFn: clinicService.getSettings,
    staleTime: 1000 * 60 * 30, // 30 minutes
  });

  const settings = settingsData?.settings || {
    clinicName: 'Avia Health Clinic',
    tagline: '',
    logo: null,
    address: {},
    phones: [],
    email: '',
    timings: '',
  };

  const value = {
    settings,
    isLoading,
  };

  return (
    <ClinicContext.Provider value={value}>
      {children}
    </ClinicContext.Provider>
  );
}

export function useClinic() {
  const context = useContext(ClinicContext);
  if (!context) {
    throw new Error('useClinic must be used within a ClinicProvider');
  }
  return context;
}

export default ClinicContext;
