/**
 * CONTRACT 2: COLOR AUTHORITY (LOCKED ORDER)
 * 
 * Color resolved in exact precedence:
 * 1. FenceVariant config
 * 2. UCK attributes
 * 3. MaterialCatalog (informational only)
 * 4. CompanySkuMap override (optional)
 */

export function validateColorAuthority({
  variantConfig,
  uckAttributes,
  catalogItem,
  materialType
}) {
  const errors = [];
  
  // Check if material requires color
  const colorRequired = ['Vinyl', 'Aluminum'].includes(materialType);
  const coatingRequired = materialType === 'Chain Link';
  
  if (colorRequired) {
    // Check variant config first (PRIMARY)
    if (!variantConfig?.color) {
      errors.push({
        code: 'MISSING_COLOR_IN_VARIANT',
        message: `${materialType} requires color in variant config`,
        severity: 'BLOCKING',
        actionHint: 'Set fence color in job configuration'
      });
    }
    
    // Check UCK attributes match variant
    if (uckAttributes?.color && variantConfig?.color) {
      if (uckAttributes.color !== variantConfig.color.toLowerCase().replace(/\s+/g, '_')) {
        errors.push({
          code: 'COLOR_MISMATCH',
          message: 'UCK color does not match variant config',
          severity: 'WARN',
          context: {
            variant_color: variantConfig.color,
            uck_color: uckAttributes.color
          }
        });
      }
    }
  }
  
  if (coatingRequired) {
    if (!variantConfig?.coating) {
      errors.push({
        code: 'MISSING_COATING_IN_VARIANT',
        message: 'Chain Link requires coating in variant config',
        severity: 'BLOCKING',
        actionHint: 'Set coating (Galvanized/Aluminized/Black Vinyl)'
      });
    }
    
    // Check UCK attributes match variant
    if (uckAttributes?.coating && variantConfig?.coating) {
      const normalizedCoating = variantConfig.coating.toLowerCase().replace(/\s+/g, '_');
      if (uckAttributes.coating !== normalizedCoating) {
        errors.push({
          code: 'COATING_MISMATCH',
          message: 'UCK coating does not match variant config',
          severity: 'WARN',
          context: {
            variant_coating: variantConfig.coating,
            uck_coating: uckAttributes.coating
          }
        });
      }
    }
  }
  
  return {
    valid: errors.filter(e => e.severity === 'BLOCKING').length === 0,
    errors
  };
}