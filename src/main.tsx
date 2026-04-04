/// <reference types="vite/client" />
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/react'
import { DependencyProvider, Dependencies } from './context/DependencyContext'
import { ClerkAuthAdapter } from './infrastructure/adapters/ClerkAuthAdapter'
import { StripePaymentAdapter } from './infrastructure/adapters/StripePaymentAdapter'
import { ToastProvider } from './components/ui/Toast'
import './index.css'
import App from './App.tsx'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
const APP_ENV = import.meta.env.VITE_APP_ENV || 'development'

console.log(`[App] Initializing in ${APP_ENV} mode`)

if (!PUBLISHABLE_KEY) {
  console.warn('Missing VITE_CLERK_PUBLISHABLE_KEY. Authentication will not work.')
}

const appDependencies = {
  auth: ClerkAuthAdapter,
  payment: StripePaymentAdapter
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
      <ToastProvider>
        <DependencyProvider initialDependencies={appDependencies}>
          <App />
        </DependencyProvider>
      </ToastProvider>
    </ClerkProvider>
  </StrictMode>,
)
