/**
 * Type definitions for Field Document generation
 */

/**
 * @typedef {Object} FieldDocRequest
 * @property {string} jobId - Job ID to export
 * @property {string} [companyId] - Company ID override
 * @property {boolean} [includePhotos] - Include photo sheet
 * @property {"combined"|"mapOnly"|"materialsOnly"} [output] - Output type
 */

/**
 * @typedef {Object} FieldDocResult
 * @property {boolean} ok - Success flag
 * @property {string} [pdfBlobUrl] - Blob URL for PDF download
 * @property {string} [error] - Error message if failed
 * @property {Object} [meta] - Metadata about generation
 */

export {};