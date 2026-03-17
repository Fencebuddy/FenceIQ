/**
 * Build default UCK from canonical_key + job/run context
 * Output format matches existing UCK parsing: underscore-separated tokens
 * Example: vinyl_panel_privacy_6ft_savannah_white
 */

export function buildDefaultUck({ lineItem, job, run }) {
  const canonical = lineItem.canonical_key || lineItem.lineItemName || '';
  
  // Start with canonical_key normalized
  let tokens = canonical
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_')
    .replace(/'/g, '')
    .replace(/"/g, '')
    .split('_')
    .filter(t => t.length > 0);

  // Extract context
  const materialType = (run?.materialType || job?.materialType || '').toLowerCase();
  const height = extractHeight(run?.fenceHeight || job?.fenceHeight);
  const color = normalizeColor(run?.fenceColor || job?.fenceColor);
  const coating = normalizeCoating(run?.chainLinkCoating);
  
  // Add height token if not already present
  if (height && !tokens.some(t => t.includes('ft') || t.includes(height))) {
    tokens.push(height);
  }

  // Material-specific tokens
  if (materialType === 'vinyl') {
    // Add system (savannah, lakeshore, etc)
    const system = inferVinylSystem(job);
    if (system && !tokens.includes(system)) {
      tokens.push(system);
    }
    
    // Add color
    if (color && !tokens.includes(color)) {
      tokens.push(color);
    }
  } else if (materialType === 'chain link') {
    // Add coating
    if (coating && !tokens.includes(coating)) {
      tokens.push(coating);
    }
  } else if (materialType === 'aluminum') {
    // Add color
    if (color && !tokens.includes(color)) {
      tokens.push(color);
    }
  }

  return tokens.join('_');
}

function extractHeight(fenceHeight) {
  if (!fenceHeight) return null;
  const match = fenceHeight.match(/(\d+)/);
  return match ? `${match[1]}ft` : null;
}

function normalizeColor(color) {
  if (!color) return null;
  return color
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');
}

function normalizeCoating(coating) {
  if (!coating) return null;
  const map = {
    'galvanized': 'galvanized',
    'black vinyl coated': 'black_vinyl_coated',
    'aluminized': 'aluminized'
  };
  return map[coating.toLowerCase()] || coating.toLowerCase().replace(/\s+/g, '_');
}

function inferVinylSystem(job) {
  // Infer system from job data or default to 'savannah'
  // Could look at job.style, job.fenceColor patterns, etc.
  return 'savannah'; // Default for now
}