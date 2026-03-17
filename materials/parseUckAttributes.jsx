/**
 * Parse UCK into structured attributes object
 * Example UCK: vinyl_panel_privacy_6ft_savannah_white
 * Returns: { material: 'vinyl', category: 'panel', style: 'privacy', height_ft: 6, system: 'savannah', color: 'white' }
 */

export function parseUckAttributes(uck) {
  if (!uck) return {};
  
  const tokens = uck.toLowerCase().split('_').filter(t => t.length > 0);
  const attributes = {};

  // Extract material (first token typically)
  if (tokens.length > 0) {
    const material = tokens[0];
    if (['vinyl', 'chainlink', 'aluminum', 'wood', 'chain', 'concrete', 'general'].includes(material)) {
      attributes.material = material;
    }
  }

  // Extract category (panel, post, gate, fabric, hardware, rail, etc.)
  const categoryTokens = ['panel', 'post', 'gate', 'fabric', 'hardware', 'rail', 'cap', 'concrete', 'misc'];
  for (const token of tokens) {
    if (categoryTokens.includes(token)) {
      attributes.category = token;
      break;
    }
  }

  // Extract style/sub-category
  const styleTokens = ['privacy', 'picket', 'line', 'end', 'corner', 'terminal', 'ornamental', 'ranch'];
  for (const token of tokens) {
    if (styleTokens.includes(token)) {
      attributes.style = token;
      break;
    }
  }

  // Extract height (e.g., 6ft, 4ft)
  for (const token of tokens) {
    const heightMatch = token.match(/(\d+)ft/);
    if (heightMatch) {
      attributes.height_ft = parseInt(heightMatch[1]);
      break;
    }
  }

  // Extract width (e.g., 8ft for gates)
  for (const token of tokens) {
    const widthMatch = token.match(/(\d+)ft/);
    if (widthMatch && !attributes.height_ft) {
      attributes.width_ft = parseInt(widthMatch[1]);
    }
  }

  // Extract size (e.g., 2.5in, 5x5)
  for (const token of tokens) {
    const sizeMatch = token.match(/(\d+\.?\d*)in|(\d+x\d+)/);
    if (sizeMatch) {
      attributes.size_in = token;
      break;
    }
  }

  // Extract finish/color
  const finishTokens = ['white', 'tan', 'khaki', 'grey', 'black', 'cedar', 'galvanized', 'bronze', 'aluminized'];
  for (const token of tokens) {
    if (finishTokens.includes(token)) {
      attributes.finish = token;
      break;
    }
  }

  // Extract coating (for chain link)
  if (tokens.includes('black_vinyl_coated') || tokens.includes('vinyl_coated')) {
    attributes.coating = 'black_vinyl_coated';
  } else if (tokens.includes('galvanized')) {
    attributes.coating = 'galvanized';
  } else if (tokens.includes('aluminized')) {
    attributes.coating = 'aluminized';
  }

  // Extract system (savannah, lakeshore, etc.)
  const systemTokens = ['savannah', 'lakeshore', 'new_england'];
  for (const token of tokens) {
    if (systemTokens.includes(token)) {
      attributes.system = token;
      break;
    }
  }

  return attributes;
}