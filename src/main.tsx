import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import App from './App.tsx';
import { MobileApp } from '@/components/mobile/MobileApp';
import { ESessionApp } from '@/components/esession-room/ESessionApp';
import { isNativeApp } from '@/lib/native';
import './index.css';
import './lib/theme';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        {/* LIMS Mobile: members' and staff's session schedule (see src/components/mobile). */}
        <Route path="/m/*" element={<MobileApp />} />
        {/* LIMS E-Session: live video sittings for members and staff (see src/components/esession-room). */}
        <Route path="/es/*" element={isNativeApp ? <Navigate to="/m" replace /> : <ESessionApp />} />
        {/* The Android app is LIMS Mobile only. */}
        <Route path="*" element={isNativeApp ? <Navigate to="/m" replace /> : <App />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
