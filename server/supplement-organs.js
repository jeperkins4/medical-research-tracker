/**
 * Supplement → Organ Protection Map
 * Shared by bone-health.js and organ-health-trackers.js
 */

import { query } from './db-secure.js';

export const ORGAN_PROTECTION_MAP = [
  { keywords: ['nac', 'n-acetyl', 'acetyl cysteine', 'acetylcysteine'],
    organs: ['kidney', 'liver', 'lung'],
    reason: 'Nephroprotective (cisplatin toxicity shield), glutathione precursor, antioxidant in lung/liver' },
  { keywords: ['omega-3', 'omega 3', 'fish oil', 'epa', 'dha'],
    organs: ['kidney', 'liver', 'lung'],
    reason: 'Anti-inflammatory: reduces proteinuria (kidney), fatty liver protection, airway inflammation' },
  { keywords: ['vitamin d3', 'vitamin d ', 'd3', 'cholecalciferol'],
    organs: ['kidney', 'bone', 'lung'],
    reason: 'CKD management, bone mineralization, pulmonary immune modulation' },
  { keywords: ['magnesium', 'mag glycinate', 'mag citrate'],
    organs: ['kidney', 'bone'],
    reason: 'Kidney stone prevention, bone formation co-factor, Vitamin D activation' },
  { keywords: ['alpha lipoic', 'alpha-lipoic', 'lipoic acid'],
    organs: ['kidney', 'liver'],
    reason: 'Antioxidant in nephrons and hepatocytes; reduces cisplatin nephrotoxicity' },
  { keywords: ['coq10', 'coenzyme q10', 'ubiquinol', 'ubiquinone'],
    organs: ['kidney', 'liver'],
    reason: 'Mitochondrial support in nephrons; hepatic energy metabolism' },
  { keywords: ['astragalus'],
    organs: ['kidney', 'lung'],
    reason: 'Nephroprotective (reduces proteinuria), pulmonary immune support' },
  { keywords: ['berberine'],
    organs: ['kidney', 'liver'],
    reason: 'Reduces renal tubular injury, hepatoprotective via AMPK activation' },
  { keywords: ['milk thistle', 'silymarin', 'silybin'],
    organs: ['liver'],
    reason: 'Gold-standard hepatoprotective — stabilizes hepatocyte membranes, antifibrotic' },
  { keywords: ['curcumin', 'turmeric'],
    organs: ['liver', 'bone'],
    reason: 'Hepatoprotective (NF-κB suppression), anti-inflammatory; modest bone protection' },
  { keywords: ['egcg', 'green tea extract', 'green tea'],
    organs: ['liver', 'lung'],
    reason: 'Hepatoprotective antioxidant; lung protection via EGFR/NF-κB suppression' },
  { keywords: ['vitamin e', 'tocopherol', 'tocotrienol'],
    organs: ['liver', 'lung'],
    reason: 'Fat-soluble antioxidant; reduces hepatic oxidative stress and lung inflammation' },
  { keywords: ['b complex', 'b-complex', 'b12', 'b6', 'folate', 'methyl b', 'methylcobalamin'],
    organs: ['liver'],
    reason: 'Methyl donor support for liver detox pathways (methylation cycle)' },
  { keywords: ['phosphatidylcholine', 'lecithin'],
    organs: ['liver'],
    reason: 'Hepatocyte membrane integrity; supports fat emulsification in bile' },
  { keywords: ['vitamin k2', 'k2-mk7', 'mk7', 'mk-7'],
    organs: ['bone'],
    reason: 'Activates osteocalcin — directs calcium into bone matrix, not arteries' },
  { keywords: ['calcium citrate', 'calcium carbonate', 'calcium'],
    organs: ['bone'],
    reason: 'Primary bone mineral; must pair with K2 to prevent arterial calcification' },
  { keywords: ['boron'],
    organs: ['bone'],
    reason: 'Improves calcium/magnesium retention; enhances Vitamin D activation' },
  { keywords: ['strontium'],
    organs: ['bone'],
    reason: 'Increases bone formation, decreases resorption; studied in osteoporosis' },
  { keywords: ['collagen'],
    organs: ['bone'],
    reason: 'Provides bone matrix scaffold; supports osteoblast activity' },
  { keywords: ['alpha-ketoglutarate', 'alpha ketoglutarate', 'akg'],
    organs: ['bone'],
    reason: 'Collagen synthesis precursor; longevity molecule with bone matrix support' },
  { keywords: ['quercetin'],
    organs: ['lung', 'bone'],
    reason: 'Anti-inflammatory (lung airways); VEGF suppression with bone-protective effects' },
  { keywords: ['vitamin c', 'ascorbic acid', 'ascorbate', 'liposomal c'],
    organs: ['lung', 'liver'],
    reason: 'Antioxidant in alveolar tissue; hepatic collagen synthesis co-factor' },
  { keywords: ['resveratrol'],
    organs: ['lung', 'liver'],
    reason: 'SIRT1 activator — anti-inflammatory in airway and liver epithelium' },
  { keywords: ['melatonin'],
    organs: ['lung', 'liver'],
    reason: 'Anti-inflammatory, NF-κB suppression in lung tissue; hepatoprotective at high doses' },
  { keywords: ['zinc'],
    organs: ['lung'],
    reason: 'Critical for alveolar macrophage function; antiviral immune support' },
  { keywords: ['fenbendazole', 'fenbend'],
    organs: ['kidney', 'liver'],
    reason: 'Metabolized hepatically; monitor liver enzymes. Some renal clearance — watch Cr.' },
  { keywords: ['ivermectin'],
    organs: ['liver'],
    reason: 'Hepatically metabolized; periodic liver enzyme monitoring recommended' },
  { keywords: ['low dose naltrexone', 'naltrexone', 'ldn'],
    organs: ['liver'],
    reason: 'Hepatically metabolized; generally well-tolerated but monitor LFTs' },
  { keywords: ['methylene blue', 'methylthioninium'],
    organs: ['kidney', 'liver'],
    reason: 'Renal clearance primary route; mitochondrial support in both organs' },
];

/**
 * Query active medications/supplements and match against organ protection map.
 * @param {string} organType  'kidney' | 'liver' | 'lung' | 'bone'
 * @returns {{ name, dosage, organs, reason }[]}
 */
export function getProtectiveSupplements(organType) {
  let meds = [];
  try {
    meds = query(`SELECT name, dosage, brand, manufacturer FROM medications WHERE active = 1 ORDER BY name`, []);
  } catch (e) {
    console.warn('[supplement-organs] could not query medications:', e.message);
    return [];
  }

  const matches = [];
  for (const med of meds) {
    const nameLower = (med.name || '').toLowerCase();
    for (const entry of ORGAN_PROTECTION_MAP) {
      if (!entry.organs.includes(organType)) continue;
      const hit = entry.keywords.some(kw => nameLower.includes(kw.toLowerCase()));
      if (hit && !matches.find(m => m.name === med.name)) {
        matches.push({
          name: med.name,
          dosage: med.dosage || null,
          brand: med.brand || null,
          manufacturer: med.manufacturer || null,
          organs: entry.organs,
          reason: entry.reason
        });
      }
    }
  }
  return matches;
}
