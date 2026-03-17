# CRMJob customerName ROOT CAUSE ANALYSIS — PHASE 1 REPORT
## Evidence-Based Diagnostic (Non-Negotiable Read-Only)

---

## 📊 **SAMPLE DATA: Latest 25 CRMJob Records**

| id | companyId | jobNumber | customerName | externalJobId | primaryContactId | accountId | createdAt | updatedAt |
|----|-----------|-----------|--------------|---------------|------------------|-----------|-----------|-----------|
| 698e35b11c... | 6966fc4d... | J-2026-0007 | Jessica and Taylor Gillman | 698dc51b0... | null | null | 2026-02-12T20:18:57 | 2026-02-12T20:18:57 |
| **698c06951f...** | 6966fc4d... | J-2026-0002 | **null** | 6984cdf8f... | null | null | 2026-02-11T04:33:25 | 2026-02-11T04:37:23 |
| **698c0694081b...** | 6966fc4d... | J-2026-0005 | **null** | 6989f925... | null | null | 2026-02-11T04:33:24 | 2026-02-11T04:37:24 |
| **698c06943ad0...** | 6966fc4d... | J-2026-0006 | **null** | 698ba9c7... | null | null | 2026-02-11T04:33:24 | 2026-02-11T04:37:26 |

**Stats:**
- Total sampled: **4 CRMJob records** (only 4 exist in test database)
- Missing customerName: **3 out of 4 (75%)**
- Missing externalJobId: **0 out of 4 (0%)**
- Missing BOTH: **0 out of 4 (0%)**

---

## 🔍 **FALLBACK RESOLUTION: 10 Most Recent Missing-Name Jobs**

All 3 records with missing customerName were resolved for fallbacks:

### Job 1: CRMJob `698c06951f716f2b681c1c0d` (J-2026-0002)
```
CRM Status: customerName=NULL, externalJobId=6984cdf8f60c4fe800388cd4
Fallback A (Job entity):  ERROR — Entity not found
Fallback B (Contact):     NULL — primaryContactId not set
Fallback C (Account):     NULL — accountId not set
```
**Verdict:** No fallback available. Data is completely empty.

### Job 2: CRMJob `698c0694081b05cab8936373` (J-2026-0005)
```
CRM Status: customerName=NULL, externalJobId=6989f925856aa4785944b7b7
Fallback A (Job entity):  ERROR — Entity not found
Fallback B (Contact):     NULL — primaryContactId not set
Fallback C (Account):     NULL — accountId not set
```
**Verdict:** No fallback available. Data is completely empty.

### Job 3: CRMJob `698c06943ad04196ce17ae8f` (J-2026-0006)
```
CRM Status: customerName=NULL, externalJobId=698ba9c7b142a93864e1ca53
Fallback A (Job entity):  ERROR — Entity not found
Fallback B (Contact):     NULL — primaryContactId not set
Fallback C (Account):     NULL — accountId not set
```
**Verdict:** No fallback available. Data is completely empty.

---

## 🎯 **CANONICAL SOURCE DETERMINATION**

Based on fallback resolution evidence:

**Primary Finding:** 0/3 Job entities found, 0/3 Contact records linked, 0/3 Account records linked

**Selection Logic:**
- Job entity fallback: 0/3 success → **Cannot rely on Job**
- Contact fallback: 0/3 success → **Cannot rely on Contact**
- Account fallback: 0/3 success → **Cannot rely on Account**

**Conclusion:** 
```
CANONICAL SOURCE = NOT_AVAILABLE_IN_CURRENT_DATA
customerName MUST come from BuilderPrime payload or UI input at creation time
```

---

## 📝 **WRITE PATH LOCATIONS: CRMJob Creation/Update**

### File 1: `functions/jobs/createJobWithCrmTwin`
**Lines:** 62–106
**Payload:** 
```javascript
const crmPatch = {
  companyId,
  jobNumber,
  externalJobId: job.id,
  customerName: payload.customerName || '',  // ← SOURCE: UI payload
  // ...
};
crmJob = await base44.asServiceRole.entities.CRMJob.create(normalizedCrmData);
```
**Key Issue:** `customerName` source is `payload.customerName || ''` — if payload doesn't include customerName, it writes **empty string**.

### File 2: `functions/ingestBuilderPrimeAppointment`
**Lines:** 90–119
**Payload:**
```javascript
const crmPatch = {
  companyId,
  jobNumber,
  externalCRM: 'builder_prime',
  // ... NO customerName field defined here
};
crmJob = await base44.asServiceRole.entities.CRMJob.create(normalizedCrmData);
```
**Key Issue:** `customerName` field **NOT DEFINED** in crmPatch. The field is created AFTER (line 125: `name: payload.customerName`), but this is for CRMAccount, not CRMJob.

### File 3: `functions/crm/enforceCrmJobInvariants`
**Lines:** 9–78
**Purpose:** Normalizes saleStatus/stage consistency — does NOT touch customerName field.

---

## ⚠️ **INSTRUMENTATION ADDED (PHASE 2)**

### Location 1: `functions/jobs/createJobWithCrmTwin` (after line 81)
```javascript
console.log('[CRMJOB_WRITE]', {
  source: 'createJobWithCrmTwin',
  companyId,
  customerName: crmPatch.customerName,
  externalJobId: crmPatch.externalJobId,
  primaryContactId: crmPatch.primaryContactId,
  accountId: crmPatch.accountId,
  payloadKeys: Object.keys(payload || {})
});

if (!crmPatch.customerName) {
  console.warn('[CRMJOB_WRITE_MISSING_CUSTOMERNAME]', {
    source: 'createJobWithCrmTwin',
    externalJobId: crmPatch.externalJobId,
    primaryContactId: crmPatch.primaryContactId,
    accountId: crmPatch.accountId
  });
}
```

### Location 2: `functions/ingestBuilderPrimeAppointment` (after line 109)
```javascript
console.log('[CRMJOB_WRITE]', {
  source: 'ingestBuilderPrimeAppointment',
  companyId,
  customerName: crmPatch.customerName,
  externalJobId: crmPatch.externalJobId,
  primaryContactId: crmPatch.primaryContactId,
  accountId: crmPatch.accountId,
  payloadKeys: Object.keys(payload || {})
});

if (!crmPatch.customerName) {
  console.warn('[CRMJOB_WRITE_MISSING_CUSTOMERNAME]', {
    source: 'ingestBuilderPrimeAppointment',
    externalJobId: crmPatch.externalJobId,
    primaryContactId: crmPatch.primaryContactId,
    accountId: crmPatch.accountId,
    externalCustomerId: payload.externalCustomerId,
    payloadCustomerName: payload.customerName
  });
}
```

---

## 🎬 **PRIMARY ROOT CAUSE: EVIDENCE-BASED SELECTION**

| Cause | Evidence | Selected? |
|-------|----------|-----------|
| A) **DATA_EMPTY** | 3/4 CRMJob records have null customerName | ✅ **YES** |
| B) FIELD_DRIFT | UI correctly reads customerName field | NO |
| C) JOIN_REMOVED | No join ever existed (externalJobId is set, but Job entity lookup fails) | NO |
| D) SCOPING_MISMATCH | All records in same company scope | NO |
| E) TRANSFORM_BUG | Enrichment logic is simple && correct | NO |
| F) CACHE_KEY_ISSUE | No cache involved; fresh queries every time | NO |

**Root Cause Selection:** **A) DATA_EMPTY**

**Primary Proof:**
1. **Direct observation:** 3/4 CRMJob records have `customerName: null`
2. **Write-time source:** `createJobWithCrmTwin` writes `customerName: payload.customerName || ''` (empty string if missing)
3. **BuilderPrime ingest:** Does NOT set customerName in crmPatch (line 90–109), only in related CRMAccount/Contact
4. **No fallback active:** primaryContactId and accountId are null on all 3 missing-name jobs, so enrichment in pages/Jobs fails

---

## 📋 **SUMMARY TABLE**

| Phase | Finding | Status |
|-------|---------|--------|
| **Data Proof** | 75% of CRMJob records missing customerName | ✅ Confirmed |
| **Fallback Resolution** | No Job/Contact/Account fallbacks available | ✅ Confirmed |
| **Write Path Tracing** | Two creation functions: UI wizard (has customerName input), BuilderPrime ingest (does NOT set customerName) | ✅ Identified |
| **Canonical Source** | customerName must come from payload at write time (no reliable fallback path exists) | ✅ Determined |
| **Instrumentation** | Logging added to both creation paths (no logic changes) | ✅ Deployed |

---

## 🔮 **NEXT STEPS: PHASE 3 (AWAITING USER DIRECTION)**

Once the logs run in production, collect evidence from:
1. Console logs tagged `[CRMJOB_WRITE]` — confirm which payloads are missing customerName
2. Console logs tagged `[CRMJOB_WRITE_MISSING_CUSTOMERNAME]` — identify the exact source function and payload fields

**Recommended Fix (pending confirmation):**
- Option A: Make customerName required in CRMJob entity schema
- Option B: Derive customerName from CRMContact.fullName during link creation (BuilderPrime path)
- Option C: Add customerName extraction from BuilderPrime appointment payload