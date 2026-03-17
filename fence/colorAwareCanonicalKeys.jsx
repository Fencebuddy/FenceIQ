/**
 * Transform canonical keys to include color suffix
 * Ensures each variant resolves to correct color-specific catalog items
 */

export function addColorToCanonicalKey(canonicalKey, color) {
  if (!canonicalKey || !color) return canonicalKey;

  const colorLower = color.toLowerCase();
  
  // Don't double-add color if already in key (check if any color variant exists)
  const colorKeywords = ['white', 'khaki', 'black', 'grey', 'tan', 'galvanized', 'aluminized', 'cedar', 'coastal'];
  if (colorKeywords.some(c => canonicalKey.includes(`_${c}`))) {
    return canonicalKey;
  }

  // Insert color right after material type (before dimensions)
  // e.g., vinyl_post_line_5x5_6ft -> vinyl_post_line_white_5x5_6ft
  // or vinyl_panel_6ft -> vinyl_panel_white_6ft
  
  // Strategy: Find first number pattern and insert color before it
  const parts = canonicalKey.split('_');
  
  // Find where the size/dimension starts (typically where numbers appear)
  let insertIndex = parts.length - 1; // Default: before last segment
  for (let i = 0; i < parts.length; i++) {
    if (/^\d/.test(parts[i])) {
      insertIndex = i;
      break;
    }
  }
  
  // Insert color at that position
  parts.splice(insertIndex, 0, colorLower);
  return parts.join('_');
}

/**
 * Transform all line items in a takeoff to use color-aware canonical keys
 */
export function colorizeLineItems(lineItems, color) {
  if (!color || !lineItems?.length) return lineItems;

  return lineItems.map(item => ({
    ...item,
    canonical_key: addColorToCanonicalKey(item.canonical_key, color),
    canonicalKey: addColorToCanonicalKey(item.canonicalKey, color)
  }));
}

/**
 * Extract color from variant spec
 */
export function getVariantColor(variant) {
  // For vinyl: fenceColor
  if (variant?.materialType === 'Vinyl') {
    return variant?.fenceColor || 'White';
  }
  
  // For chain link: chainLinkCoating
  if (variant?.materialType === 'Chain Link') {
    const coating = variant?.chainLinkCoating;
    if (coating === 'Black Vinyl Coated') return 'Black';
    if (coating === 'Galvanized') return 'Galvanized';
    if (coating === 'Aluminized') return 'Aluminized';
    return coating || 'Galvanized';
  }

  // For aluminum: fenceColor
  if (variant?.materialType === 'Aluminum') {
    return variant?.fenceColor || 'Black';
  }

  // For wood: fenceColor
  if (variant?.materialType === 'Wood') {
    return variant?.fenceColor || 'Cedar';
  }

  return 'White';
}