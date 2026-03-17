/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AdminAgents from './pages/AdminAgents';
import AdminGenesisReset from './pages/AdminGenesisReset';
import AdminGoals from './pages/AdminGoals';
import BomEditor from './pages/BomEditor';
import BreakevenIntelligence from './pages/BreakevenIntelligence';
import Calendar from './pages/Calendar';
import CanonicalCatalogExtractor from './pages/CanonicalCatalogExtractor';
import CatalogResolverTest from './pages/CatalogResolverTest';
import CatalogValidation from './pages/CatalogValidation';
import CollectPayment from './pages/CollectPayment';
import CompanyAutomation from './pages/CompanyAutomation';
import CompanySettings from './pages/CompanySettings';
import ContextVerification from './pages/ContextVerification';
import CustomerDetail from './pages/CustomerDetail';
import Customers from './pages/Customers';
import DepositPayment from './pages/DepositPayment';
import EditJob from './pages/EditJob';
import FenceBuddyIQ from './pages/FenceBuddyIQ';
import FenceSystemConfig from './pages/FenceSystemConfig';
import FlowTraceViewer from './pages/FlowTraceViewer';
import JobDetail from './pages/JobDetail';
import Jobs from './pages/Jobs';
import JurisdictionAdmin from './pages/JurisdictionAdmin';
import KpiCommandCenter from './pages/KpiCommandCenter';
import Landing from './pages/Landing';
import Leads from './pages/Leads';
import LegalPrivacy from './pages/LegalPrivacy';
import LegalTerms from './pages/LegalTerms';
import MappingIntegrityAudit from './pages/MappingIntegrityAudit';
import MaterialCatalog from './pages/MaterialCatalog';
import MaterialsSupplierMapping from './pages/MaterialsSupplierMapping';
import MonitoringDashboard from './pages/MonitoringDashboard';
import NeighborhoodTemperature from './pages/NeighborhoodTemperature';
import NewJob from './pages/NewJob';
import OverheadIntelligence from './pages/OverheadIntelligence';
import OwnerDashboard from './pages/OwnerDashboard';
import PaymentsLog from './pages/PaymentsLog';
import PlatformAnalytics from './pages/PlatformAnalytics';
import PlatformCompanies from './pages/PlatformCompanies';
import PlatformDashboard from './pages/PlatformDashboard';
import PlatformErrors from './pages/PlatformErrors';
import PlatformSystem from './pages/PlatformSystem';
import PlatformUsers from './pages/PlatformUsers';
import PoisonMigration from './pages/PoisonMigration';
import Present from './pages/Present';
import PricingIntelligence from './pages/PricingIntelligence';
import ProfitIntelligence2 from './pages/ProfitIntelligence2';
import Proposal from './pages/Proposal';
import Signature from './pages/Signature';
import StewardshipDashboard from './pages/StewardshipDashboard';
import UckDiscoveryTool from './pages/UckDiscoveryTool';
import V2AuditReport from './pages/V2AuditReport';
import V2CoverageScanner from './pages/V2CoverageScanner';
import VinylUckMigration from './pages/VinylUckMigration';
import WorkflowBlueprint from './pages/WorkflowBlueprint';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdminAgents": AdminAgents,
    "AdminGenesisReset": AdminGenesisReset,
    "AdminGoals": AdminGoals,
    "BomEditor": BomEditor,
    "BreakevenIntelligence": BreakevenIntelligence,
    "Calendar": Calendar,
    "CanonicalCatalogExtractor": CanonicalCatalogExtractor,
    "CatalogResolverTest": CatalogResolverTest,
    "CatalogValidation": CatalogValidation,
    "CollectPayment": CollectPayment,
    "CompanyAutomation": CompanyAutomation,
    "CompanySettings": CompanySettings,
    "ContextVerification": ContextVerification,
    "CustomerDetail": CustomerDetail,
    "Customers": Customers,
    "DepositPayment": DepositPayment,
    "EditJob": EditJob,
    "FenceBuddyIQ": FenceBuddyIQ,
    "FenceSystemConfig": FenceSystemConfig,
    "FlowTraceViewer": FlowTraceViewer,
    "JobDetail": JobDetail,
    "Jobs": Jobs,
    "JurisdictionAdmin": JurisdictionAdmin,
    "KpiCommandCenter": KpiCommandCenter,
    "Landing": Landing,
    "Leads": Leads,
    "LegalPrivacy": LegalPrivacy,
    "LegalTerms": LegalTerms,
    "MappingIntegrityAudit": MappingIntegrityAudit,
    "MaterialCatalog": MaterialCatalog,
    "MaterialsSupplierMapping": MaterialsSupplierMapping,
    "MonitoringDashboard": MonitoringDashboard,
    "NeighborhoodTemperature": NeighborhoodTemperature,
    "NewJob": NewJob,
    "OverheadIntelligence": OverheadIntelligence,
    "OwnerDashboard": OwnerDashboard,
    "PaymentsLog": PaymentsLog,
    "PlatformAnalytics": PlatformAnalytics,
    "PlatformCompanies": PlatformCompanies,
    "PlatformDashboard": PlatformDashboard,
    "PlatformErrors": PlatformErrors,
    "PlatformSystem": PlatformSystem,
    "PlatformUsers": PlatformUsers,
    "PoisonMigration": PoisonMigration,
    "Present": Present,
    "PricingIntelligence": PricingIntelligence,
    "ProfitIntelligence2": ProfitIntelligence2,
    "Proposal": Proposal,
    "Signature": Signature,
    "StewardshipDashboard": StewardshipDashboard,
    "UckDiscoveryTool": UckDiscoveryTool,
    "V2AuditReport": V2AuditReport,
    "V2CoverageScanner": V2CoverageScanner,
    "VinylUckMigration": VinylUckMigration,
    "WorkflowBlueprint": WorkflowBlueprint,
}

export const pagesConfig = {
    mainPage: "MonitoringDashboard",
    Pages: PAGES,
    Layout: __Layout,
};