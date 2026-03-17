/**
 * findCustomerNameCandidates.js — Shared helper to search multiple entities for name candidates
 * Used by both diagnostic and repair functions
 */

export function safeText(v) {
  const s = (v ?? "").toString().trim();
  return s.length ? s : null;
}

function extractNameFields(obj) {
  if (!obj) return {};
  return {
    customerName: safeText(obj.customerName),
    fullName: safeText(obj.fullName),
    name: safeText(obj.name),
    firstName: safeText(obj.firstName),
    lastName: safeText(obj.lastName),
    email: safeText(obj.email),
    phone: safeText(obj.phone)
  };
}

function getBestCandidate(nameFields) {
  if (!nameFields) return null;
  return (
    nameFields.customerName ||
    nameFields.fullName ||
    nameFields.name ||
    (nameFields.firstName && nameFields.lastName ? `${nameFields.firstName} ${nameFields.lastName}` : null) ||
    nameFields.firstName ||
    nameFields.email ||
    nameFields.phone ||
    null
  );
}

export async function searchCandidateSources(base44, crmJob, tenantId) {
  const candidateSources = [];

  // 1) Job entity (if externalJobId present)
  let jobFound = false,
    jobCandidates = {};
  if (crmJob.externalJobId) {
    try {
      const job = await base44.entities.Job.read(crmJob.externalJobId);
      if (job) {
        jobFound = true;
        jobCandidates = extractNameFields(job);
      }
    } catch {}
  }
  candidateSources.push({
    source: "Job",
    found: jobFound,
    candidates: jobCandidates
  });

  // 2) CRMContact (if primaryContactId present)
  let contactFound = false,
    contactCandidates = {};
  if (crmJob.primaryContactId) {
    try {
      const contact = await base44.entities.CRMContact.read(crmJob.primaryContactId);
      if (contact) {
        contactFound = true;
        contactCandidates = extractNameFields(contact);
      }
    } catch {}
  }
  candidateSources.push({
    source: "CRMContact",
    found: contactFound,
    candidates: contactCandidates
  });

  // 3) CRMAccount (if accountId present)
  let accountFound = false,
    accountCandidates = {};
  if (crmJob.accountId) {
    try {
      const account = await base44.entities.CRMAccount.read(crmJob.accountId);
      if (account) {
        accountFound = true;
        accountCandidates = extractNameFields(account);
      }
    } catch {}
  }
  candidateSources.push({
    source: "CRMAccount",
    found: accountFound,
    candidates: accountCandidates
  });

  // Find the best candidate overall
  let bestCandidate = null;
  for (const source of candidateSources) {
    const best = getBestCandidate(source.candidates);
    if (best) {
      bestCandidate = {
        source: source.source,
        customerName: best
      };
      break; // First source with a candidate wins
    }
  }

  return { candidateSources, bestCandidate };
}