// Jurisdiction Rules Engine for FenceBuddy
// Merges default rules with county and jurisdiction-specific overrides

/**
 * Deep merge two objects - later object values override earlier ones
 * Arrays are replaced, not concatenated
 */
function deepMerge(target, source) {
  if (!source) return target;
  
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
}

/**
 * Get merged jurisdiction rules
 * @param {Object} params
 * @param {string} params.state - State code (default: "MI")
 * @param {string} params.county - County name (Kent, Ottawa, Muskegon, Mecosta)
 * @param {string} params.jurisdiction_name - City/Township name
 * @param {Object} params.defaults - JurisdictionRuleDefaults.config_json
 * @param {Array} params.overrides - Array of JurisdictionOverride records
 * @returns {Object} Merged rules with alerts
 */
export function getJurisdictionRules({ 
  state = 'MI', 
  county, 
  jurisdiction_name, 
  defaults, 
  overrides = [] 
}) {
  if (!defaults || !defaults.default_rules) {
    return {
      rules: {},
      alerts: {},
      disclaimer: '',
      unknown_jurisdiction: true
    };
  }

  // Start with default rules
  let merged = { ...defaults.default_rules };

  // Apply county-level overrides if they exist
  if (county && defaults.counties && defaults.counties[county]) {
    const countyConfig = defaults.counties[county];
    if (countyConfig.overrides) {
      merged = deepMerge(merged, countyConfig.overrides);
    }
  }

  // Find matching jurisdiction override
  const jurisdictionOverride = overrides.find(
    o => o.state === state && 
         o.county === county && 
         o.jurisdiction_name === jurisdiction_name &&
         o.is_active
  );

  // Apply jurisdiction-specific overrides
  if (jurisdictionOverride && jurisdictionOverride.override_json) {
    merged = deepMerge(merged, jurisdictionOverride.override_json);
  }

  // Determine if jurisdiction is unknown
  const unknown_jurisdiction = !!(jurisdiction_name && !jurisdictionOverride);

  // Build alerts object
  const alerts = {
    ...defaults.alerts,
    unknown_jurisdiction: unknown_jurisdiction ? defaults.alerts.unknown_jurisdiction : null
  };

  return {
    rules: merged,
    alerts,
    disclaimer: defaults.disclaimer || '',
    county_info: county && defaults.counties ? defaults.counties[county] : null,
    jurisdiction_override: jurisdictionOverride,
    unknown_jurisdiction
  };
}

/**
 * Parse CSV text and return array of jurisdiction override objects
 * Format: state,county,jurisdiction_name,jurisdiction_type,override_json,notes,source_url,last_verified
 */
export function parseJurisdictionCSV(csvText) {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  
  const results = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Simple CSV parser - handles quoted fields
    const values = [];
    let currentValue = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(currentValue.trim());
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    values.push(currentValue.trim());
    
    // Map to object
    const obj = {};
    headers.forEach((header, idx) => {
      let value = values[idx] || '';
      
      // Remove surrounding quotes if present
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      
      // Parse override_json
      if (header === 'override_json' && value) {
        try {
          // Replace escaped quotes
          value = value.replace(/""/g, '"');
          obj[header] = JSON.parse(value);
        } catch (e) {
          console.error('Failed to parse override_json:', value, e);
          obj[header] = {};
        }
      } else {
        obj[header] = value;
      }
    });
    
    if (obj.state && obj.county && obj.jurisdiction_name) {
      results.push(obj);
    }
  }
  
  return results;
}