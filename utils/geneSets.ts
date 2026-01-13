/**
 * Gene set databases for ORA analysis
 * This would typically be loaded from external databases
 */

import type { GeneSet } from './ora';

// Sample Gene Ontology Biological Process terms
export const GO_BP_SAMPLE: GeneSet[] = [
    {
        id: 'GO:0008150',
        name: 'biological_process',
        description: 'A biological process represents a specific objective that the organism is genetically programmed to achieve.',
        category: 'GO',
        subcategory: 'BP',
        genes: [] // This would contain actual gene IDs
    },
    {
        id: 'GO:0006955',
        name: 'immune_response',
        description: 'Any immune system process that functions in the calibrated response of an organism to a potential internal or invasive threat.',
        category: 'GO',
        subcategory: 'BP',
        genes: ['CD4', 'CD8A', 'IL2', 'IFNG', 'TNF', 'IL10', 'TLR4', 'MYD88', 'NFKB1']
    },
    {
        id: 'GO:0006412',
        name: 'translation',
        description: 'The cellular metabolic process in which a protein is formed, using the sequence of a mature mRNA or circRNA molecule to specify the sequence of amino acids in a protein.',
        category: 'GO',
        subcategory: 'BP',
        genes: ['RPS6', 'RPL7', 'EIF4E', 'EIF4G1', 'EEF1A1', 'EEF2', 'PABP1']
    },
    {
        id: 'GO:0006281',
        name: 'DNA_repair',
        description: 'The process of restoring DNA after damage.',
        category: 'GO',
        subcategory: 'BP',
        genes: ['TP53', 'BRCA1', 'BRCA2', 'ATM', 'ATR', 'CHEK1', 'CHEK2', 'RAD51']
    },
    {
        id: 'GO:0006915',
        name: 'apoptotic_process',
        description: 'A form of programmed cell death that begins when a cell receives an internal or external signal that triggers the activation of proteolytic caspases.',
        category: 'GO',
        subcategory: 'BP',
        genes: ['TP53', 'BCL2', 'BAX', 'CASP3', 'CASP9', 'APAF1', 'CYCS', 'FAS']
    }
];

// Sample KEGG pathways
export const KEGG_PATHWAYS_SAMPLE: GeneSet[] = [
    {
        id: 'hsa04110',
        name: 'Cell cycle',
        description: 'The cell cycle is a series of events that cells go through as they grow and divide.',
        category: 'KEGG',
        genes: ['CCND1', 'CCNE1', 'CDK2', 'CDK4', 'RB1', 'E2F1', 'TP53', 'CDKN1A']
    },
    {
        id: 'hsa04210',
        name: 'Apoptosis',
        description: 'Apoptosis is the process of programmed cell death.',
        category: 'KEGG',
        genes: ['TP53', 'BCL2', 'BAX', 'CASP3', 'CASP8', 'CASP9', 'FAS', 'TNF']
    },
    {
        id: 'hsa04060',
        name: 'Cytokine-cytokine receptor interaction',
        description: 'Cytokines are small signaling proteins that are crucial in controlling the growth and activity of other immune system cells and blood cells.',
        category: 'KEGG',
        genes: ['IL1A', 'IL1B', 'IL2', 'IL6', 'TNF', 'IFNA1', 'IFNG', 'TGFβ1']
    },
    {
        id: 'hsa03040',
        name: 'Spliceosome',
        description: 'The spliceosome is a dynamic ribonucleoprotein complex that removes introns from pre-mRNA.',
        category: 'KEGG',
        genes: ['SNRNP70', 'SF3B1', 'U2AF1', 'SRSF1', 'HNRNPA1', 'PRPF8', 'LSM2']
    }
];

// Sample MSigDB Hallmark gene sets
export const HALLMARK_SAMPLE: GeneSet[] = [
    {
        id: 'HALLMARK_INFLAMMATORY_RESPONSE',
        name: 'Inflammatory Response',
        description: 'Genes defining inflammatory response',
        category: 'Hallmark',
        genes: ['TNF', 'IL1A', 'IL1B', 'IL6', 'NFKB1', 'RELA', 'TLR4', 'MYD88', 'IRAK1']
    },
    {
        id: 'HALLMARK_APOPTOSIS',
        name: 'Apoptosis',
        description: 'Genes mediating programmed cell death',
        category: 'Hallmark',
        genes: ['TP53', 'BCL2', 'BAX', 'CASP3', 'CASP8', 'CASP9', 'APAF1', 'CYCS']
    },
    {
        id: 'HALLMARK_P53_PATHWAY',
        name: 'P53 Pathway',
        description: 'Genes involved in p53 pathways and networks',
        category: 'Hallmark',
        genes: ['TP53', 'MDM2', 'CDKN1A', 'BAX', 'PUMA', 'NOXA', 'ATM', 'CHEK2']
    },
    {
        id: 'HALLMARK_MYC_TARGETS_V1',
        name: 'MYC Targets V1',
        description: 'A subgroup of genes regulated by MYC - version 1',
        category: 'Hallmark',
        genes: ['MYC', 'CCND2', 'CDK4', 'E2F1', 'RRM2', 'TK1', 'TYMS', 'DHFR']
    },
    {
        id: 'HALLMARK_OXIDATIVE_PHOSPHORYLATION',
        name: 'Oxidative Phosphorylation',
        description: 'Genes encoding proteins involved in oxidative phosphorylation',
        category: 'Hallmark',
        genes: ['COX4I1', 'COX5A', 'COX6A1', 'ATP5A1', 'ATP5B', 'NDUFA1', 'NDUFB1']
    }
];

/**
 * Get all available gene sets
 */
export function getAllGeneSets(): GeneSet[] {
    return [
        ...GO_BP_SAMPLE,
        ...KEGG_PATHWAYS_SAMPLE,
        ...HALLMARK_SAMPLE
    ];
}

/**
 * Get gene sets by category
 */
export function getGeneSetsByCategory(category: 'GO' | 'KEGG' | 'Hallmark'): GeneSet[] {
    const allSets = getAllGeneSets();
    return allSets.filter(set => set.category === category);
}

/**
 * Search gene sets by name or description
 */
export function searchGeneSets(query: string): GeneSet[] {
    const allSets = getAllGeneSets();
    const lowerQuery = query.toLowerCase();
    
    return allSets.filter(set => 
        set.name.toLowerCase().includes(lowerQuery) || 
        set.description.toLowerCase().includes(lowerQuery)
    );
}

/**
 * Load gene sets from external source (placeholder)
 * In a real implementation, this would fetch from APIs like:
 * - Gene Ontology: http://geneontology.org/
 * - KEGG: https://www.kegg.jp/
 * - MSigDB: https://www.gsea-msigdb.org/
 */
export async function loadGeneSetDatabase(source: 'GO' | 'KEGG' | 'MSigDB'): Promise<GeneSet[]> {
    // This is a placeholder for loading external databases
    // In practice, you would implement actual API calls or file parsing
    
    console.warn('loadGeneSetDatabase is not implemented - using sample data');
    
    switch (source) {
        case 'GO':
            return GO_BP_SAMPLE;
        case 'KEGG':
            return KEGG_PATHWAYS_SAMPLE;
        case 'MSigDB':
            return HALLMARK_SAMPLE;
        default:
            return [];
    }
}

/**
 * Create a background gene set from your data
 * This should represent all genes that were measured/detected in your experiment
 */
export function createBackgroundGeneSet(allGenes: string[]): GeneSet {
    return {
        id: 'BACKGROUND',
        name: 'Background Genes',
        description: 'All genes measured in the experiment',
        category: 'Custom',
        genes: allGenes
    };
}
