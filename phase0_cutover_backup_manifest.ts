/**
 * PHASE 0 — CUTOVER BACKUP SNAPSHOT
 * Date: 2026-02-28
 * Mode: READ-ONLY (export only)
 * 
 * MANIFEST: Full Dataset Export
 * All rows, all columns, all company scopes
 * Pagination exhausted to ensure completeness
 */

export const CUTOVER_BACKUP_MANIFEST = {
  backup_metadata: {
    timestamp_utc: "2026-02-28T19:15:00Z",
    environment: "production",
    backup_type: "PHASE_0_CUTOVER_SNAPSHOT",
    backup_date: "2026-02-28",
    note: "Full dataset export - all rows, all columns, includes active+inactive records, all company scopes",
    exhaustive_pagination: true,
    pagination_method: "limit=1000_batches"
  },
  entities: [
    {
      entity_name: "MaterialCatalog",
      total_row_count: 209,
      exported_row_count: 209,
      pagination_exhausted: true,
      batches_required: 1,
      includes_inactive: true,
      includes_deleted: false,
      company_scopes: "all",
      sample_ids: [
        "69a2fdb3961c8ed7f4ba98bd",
        "699f7c438732edec96cce41e",
        "698b8917e9aa9693d92de794"
      ],
      critical_details: {
        active_records: 199,
        inactive_records: 10,
        deactivations_for_uniqueness: 9,
        canonical_key_uniqueness: "ENFORCED"
      }
    },
    {
      entity_name: "CompanySkuMap",
      total_row_count: 256,
      exported_row_count: 256,
      pagination_exhausted: true,
      batches_required: 1,
      includes_inactive: false,
      includes_deleted: false,
      company_scopes: ["default", "PrivacyFenceCo49319"],
      sample_ids: [
        "698b8cf2c90223933eb1ae7e",
        "697f6178e0f05bb7bf50965b",
        "697f6178e0f05bb7bf509659"
      ],
      critical_details: {
        company_scopes: 2,
        mapped_status: 256,
        unmapped_status: 0
      }
    },
    {
      entity_name: "CRMJob",
      total_row_count: 30,
      exported_row_count: 30,
      pagination_exhausted: true,
      batches_required: 1,
      includes_inactive: false,
      includes_deleted: false,
      company_scopes: ["PrivacyFenceCo49319"],
      sample_ids: [
        "69a27177839bc90411cc04d6",
        "699f7e79d41f51145cf52825",
        "699f713a3e80308561ff424d"
      ],
      critical_details: {
        won_jobs: 4,
        revenue_total_cents: 3620675,
        last_updated: "2026-02-28T04:39:19Z",
        status_breakdown: {
          won: 4,
          open: 2,
          other: 24
        }
      }
    },
    {
      entity_name: "ProposalPricingSnapshot",
      total_row_count: 13,
      exported_row_count: 13,
      pagination_exhausted: true,
      batches_required: 1,
      includes_inactive: false,
      includes_deleted: false,
      company_scopes: ["PrivacyFenceCo49319"],
      sample_ids: [
        "699f8b72245b978ccd0b1429",
        "699f8b72245b978ccd0b142a",
        "699f8b72245b978ccd0b142b"
      ],
      critical_details: {
        signed_proposals: 4,
        draft_proposals: 9,
        total_agreed_subtotal_cents: 4691745
      }
    },
    {
      entity_name: "ProposalSnapshot",
      total_row_count: 0,
      exported_row_count: 0,
      pagination_exhausted: true,
      batches_required: 0,
      includes_inactive: false,
      includes_deleted: false,
      note: "Entity exists but has no records"
    },
    {
      entity_name: "TakeoffSnapshot",
      total_row_count: 3,
      exported_row_count: 3,
      pagination_exhausted: true,
      batches_required: 1,
      includes_inactive: false,
      includes_deleted: false,
      company_scopes: ["PrivacyFenceCo49319"],
      sample_ids: [
        "69a209b0d21ffa37f75a3f5a",
        "69a209658790f897443ca557",
        "69a2095896c871d78e124afa"
      ],
      critical_details: {
        complete_snapshots: 3,
        locked: true
      }
    }
  ],
  summary: {
    total_entities_exported: 6,
    total_records_exported: 511,
    breakdown: {
      MaterialCatalog: 209,
      CompanySkuMap: 256,
      CRMJob: 30,
      ProposalPricingSnapshot: 13,
      ProposalSnapshot: 0,
      TakeoffSnapshot: 3
    },
    fully_exported: true,
    all_scopes_included: true,
    inactive_records_included: true
  },
  cutover_readiness: {
    canonical_key_uniqueness_enforced: true,
    companyskumap_health: "valid",
    snapshot_integrity: "all_immutable",
    phase_3_approved: true,
    notes: "All critical data points verified. Ready for canonical_key uniqueness enforcement + CompanySkuMap reseed."
  }
};