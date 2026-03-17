import './App.css'
import { useEffect, useState } from 'react'
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import VisualEditAgent from '@/lib/VisualEditAgent'
import NavigationTracker from '@/lib/NavigationTracker'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom'
import PageNotFound from './lib/PageNotFound'
import UserNotRegisteredError from '@/components/UserNotRegisteredError'
import { base44 } from '@/api/base44Client'
import Layout from './Layout.jsx'
import { TakeoffStoreProvider } from '@/components/stores/useTakeoffStore'

// Import all pages
import Landing from './pages/Landing'
import OwnerDashboard from './pages/OwnerDashboard'
import Jobs from './pages/Jobs'
import Leads from './pages/Leads'
import Customers from './pages/Customers'
import Calendar from './pages/Calendar'
import CompanySettings from './pages/CompanySettings'
import MaterialCatalog from './pages/MaterialCatalog'
import AdminGoals from './pages/AdminGoals'
import FenceBuddyIQ from './pages/FenceBuddyIQ'
import MaterialsSupplierMapping from './pages/MaterialsSupplierMapping'
import OverheadIntelligence from './pages/OverheadIntelligence'
import BreakevenIntelligence from './pages/BreakevenIntelligence'
import NeighborhoodTemperature from './pages/NeighborhoodTemperature'
import StewardshipDashboard from './pages/StewardshipDashboard'
import CustomerDetail from './pages/CustomerDetail'
import JobDetail from './pages/JobDetail'
import LeadDetail from './pages/LeadDetail'
import EditJob from './pages/EditJob'
import NewJob from './pages/NewJob'

import ContextVerification from './pages/ContextVerification'
import ProfitIntelligence2 from './pages/ProfitIntelligence2'
import PricingIntelligence from './pages/PricingIntelligence'
import MonitoringDashboard from './pages/MonitoringDashboard'
import KpiCommandCenter from './pages/KpiCommandCenter'
import AdminAgents from './pages/AdminAgents'
import CompanyAutomation from './pages/CompanyAutomation'
import CollectPayment from './pages/CollectPayment'
import PaymentsLog from './pages/PaymentsLog'
import WebhookEventLog from './pages/WebhookEventLog'
import Present from './pages/Present'
import Proposal from './pages/Proposal'
import Signature from './pages/Signature'
import DepositPayment from './pages/DepositPayment'

const mainPageKey = 'OwnerDashboard'
const MainPage = OwnerDashboard

const LayoutWrapper = ({ children, currentPageName }) =>
  Layout ? <Layout currentPageName={currentPageName}>{children}</Layout> : <>{children}</>

const AppContent = () => {
  const [isLoading, setIsLoading] = useState(true)
  const [authError, setAuthError] = useState(null)

  useEffect(() => {
    let mounted = true

    const checkAuth = async () => {
      try {
        setIsLoading(true)
        setAuthError(null)

        await base44.auth.me()

        if (mounted) setIsLoading(false)
      } catch (error) {
        if (!mounted) return

        const errorType =
          error?.type ||
          error?.code ||
          error?.response?.data?.type ||
          error?.response?.data?.code

        if (errorType === 'user_not_registered') {
          setAuthError('user_not_registered')
          setIsLoading(false)
          return
        }

        setAuthError('auth_required')
        setIsLoading(false)

        if (typeof base44.auth?.redirectToLogin === 'function') {
          base44.auth.redirectToLogin(window.location.href)
        }
      }
    }

    checkAuth()
    return () => {
      mounted = false
    }
  }, [])

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    )
  }

  if (authError === 'user_not_registered') {
    return <UserNotRegisteredError />
  }

  if (authError === 'auth_required') {
    return null
  }

  return (
    <Routes>
      <Route path="/Landing" element={<Landing />} />
      <Route path="/" element={<Navigate to="/OwnerDashboard" replace />} />
      
      {/* Main routes with layout */}
      <Route path="/OwnerDashboard" element={<LayoutWrapper currentPageName="OwnerDashboard"><OwnerDashboard /></LayoutWrapper>} />
      <Route path="/Jobs" element={<LayoutWrapper currentPageName="Jobs"><Jobs /></LayoutWrapper>} />
      <Route path="/Leads" element={<LayoutWrapper currentPageName="Leads"><Leads /></LayoutWrapper>} />
      <Route path="/Customers" element={<LayoutWrapper currentPageName="Customers"><Customers /></LayoutWrapper>} />
      <Route path="/Calendar" element={<LayoutWrapper currentPageName="Calendar"><Calendar /></LayoutWrapper>} />
      <Route path="/CompanySettings" element={<LayoutWrapper currentPageName="CompanySettings"><CompanySettings /></LayoutWrapper>} />
      <Route path="/MaterialCatalog" element={<LayoutWrapper currentPageName="MaterialCatalog"><MaterialCatalog /></LayoutWrapper>} />
      <Route path="/AdminGoals" element={<LayoutWrapper currentPageName="AdminGoals"><AdminGoals /></LayoutWrapper>} />
      <Route path="/FenceBuddyIQ" element={<LayoutWrapper currentPageName="FenceBuddyIQ"><FenceBuddyIQ /></LayoutWrapper>} />
      <Route path="/MaterialsSupplierMapping" element={<LayoutWrapper currentPageName="MaterialsSupplierMapping"><MaterialsSupplierMapping /></LayoutWrapper>} />
      <Route path="/OverheadIntelligence" element={<LayoutWrapper currentPageName="OverheadIntelligence"><OverheadIntelligence /></LayoutWrapper>} />
      <Route path="/BreakevenIntelligence" element={<LayoutWrapper currentPageName="BreakevenIntelligence"><BreakevenIntelligence /></LayoutWrapper>} />
      <Route path="/NeighborhoodTemperature" element={<LayoutWrapper currentPageName="NeighborhoodTemperature"><NeighborhoodTemperature /></LayoutWrapper>} />
      <Route path="/StewardshipDashboard" element={<LayoutWrapper currentPageName="StewardshipDashboard"><StewardshipDashboard /></LayoutWrapper>} />
      <Route path="/CustomerDetail" element={<LayoutWrapper currentPageName="CustomerDetail"><CustomerDetail /></LayoutWrapper>} />
      <Route path="/JobDetail" element={<LayoutWrapper currentPageName="JobDetail"><JobDetail /></LayoutWrapper>} />
      <Route path="/LeadDetail" element={<LayoutWrapper currentPageName="LeadDetail"><LeadDetail /></LayoutWrapper>} />
      <Route path="/EditJob" element={<LayoutWrapper currentPageName="EditJob"><EditJob /></LayoutWrapper>} />
      <Route path="/NewJob" element={<LayoutWrapper currentPageName="NewJob"><NewJob /></LayoutWrapper>} />

      <Route path="/ContextVerification" element={<LayoutWrapper currentPageName="ContextVerification"><ContextVerification /></LayoutWrapper>} />
      <Route path="/ProfitIntelligence2" element={<LayoutWrapper currentPageName="ProfitIntelligence2"><ProfitIntelligence2 /></LayoutWrapper>} />
      <Route path="/PricingIntelligence" element={<LayoutWrapper currentPageName="PricingIntelligence"><PricingIntelligence /></LayoutWrapper>} />
      <Route path="/MonitoringDashboard" element={<LayoutWrapper currentPageName="MonitoringDashboard"><MonitoringDashboard /></LayoutWrapper>} />
      <Route path="/KpiCommandCenter" element={<LayoutWrapper currentPageName="KpiCommandCenter"><KpiCommandCenter /></LayoutWrapper>} />
      <Route path="/AdminAgents" element={<LayoutWrapper currentPageName="AdminAgents"><AdminAgents /></LayoutWrapper>} />
      <Route path="/CompanyAutomation" element={<LayoutWrapper currentPageName="CompanyAutomation"><CompanyAutomation /></LayoutWrapper>} />
      <Route path="/CollectPayment" element={<LayoutWrapper currentPageName="CollectPayment"><CollectPayment /></LayoutWrapper>} />
      <Route path="/PaymentsLog" element={<LayoutWrapper currentPageName="PaymentsLog"><PaymentsLog /></LayoutWrapper>} />
      <Route path="/WebhookEventLog" element={<LayoutWrapper currentPageName="WebhookEventLog"><WebhookEventLog /></LayoutWrapper>} />
      <Route path="/Present" element={<TakeoffStoreProvider><Present /></TakeoffStoreProvider>} />
      <Route path="/Proposal" element={<Proposal />} />
      <Route path="/Signature" element={<Signature />} />
      <Route path="/DepositPayment" element={<DepositPayment />} />
      
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <Router>
        <NavigationTracker />
        <AppContent />
      </Router>
      <Toaster />
      <VisualEditAgent />
    </QueryClientProvider>
  )
}

export default App