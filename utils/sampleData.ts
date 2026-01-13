/**
 * Sample data for testing ORA functionality
 */

import type { Gene } from './ora';

// Sample genes with differential expression data
export const SAMPLE_GENES: Gene[] = [
    // Up-regulated genes (immune response)
    { id: 'CD4', symbol: 'CD4', log2fc: 2.1, padj: 0.001 },
    { id: 'CD8A', symbol: 'CD8A', log2fc: 1.8, padj: 0.003 },
    { id: 'IL2', symbol: 'IL2', log2fc: 2.5, padj: 0.0001 },
    { id: 'IFNG', symbol: 'IFNG', log2fc: 1.9, padj: 0.002 },
    { id: 'TNF', symbol: 'TNF', log2fc: 2.3, padj: 0.0005 },
    { id: 'IL10', symbol: 'IL10', log2fc: 1.6, padj: 0.008 },
    { id: 'TLR4', symbol: 'TLR4', log2fc: 1.4, padj: 0.012 },
    { id: 'MYD88', symbol: 'MYD88', log2fc: 1.7, padj: 0.006 },
    { id: 'NFKB1', symbol: 'NFKB1', log2fc: 1.5, padj: 0.009 },
    
    // Down-regulated genes (cell cycle)
    { id: 'CCND1', symbol: 'CCND1', log2fc: -2.1, padj: 0.001 },
    { id: 'CCNE1', symbol: 'CCNE1', log2fc: -1.8, padj: 0.004 },
    { id: 'CDK2', symbol: 'CDK2', log2fc: -1.9, padj: 0.003 },
    { id: 'CDK4', symbol: 'CDK4', log2fc: -1.6, padj: 0.007 },
    { id: 'RB1', symbol: 'RB1', log2fc: -1.4, padj: 0.011 },
    { id: 'E2F1', symbol: 'E2F1', log2fc: -2.2, padj: 0.0008 },
    
    // Apoptosis genes (mixed)
    { id: 'TP53', symbol: 'TP53', log2fc: 1.3, padj: 0.015 },
    { id: 'BCL2', symbol: 'BCL2', log2fc: -1.1, padj: 0.025 },
    { id: 'BAX', symbol: 'BAX', log2fc: 1.8, padj: 0.004 },
    { id: 'CASP3', symbol: 'CASP3', log2fc: 1.5, padj: 0.009 },
    { id: 'CASP9', symbol: 'CASP9', log2fc: 1.2, padj: 0.018 },
    { id: 'APAF1', symbol: 'APAF1', log2fc: 1.4, padj: 0.012 },
    { id: 'CYCS', symbol: 'CYCS', log2fc: 1.1, padj: 0.023 },
    { id: 'FAS', symbol: 'FAS', log2fc: 1.7, padj: 0.005 },
    
    // Translation genes (up-regulated)
    { id: 'RPS6', symbol: 'RPS6', log2fc: 1.3, padj: 0.014 },
    { id: 'RPL7', symbol: 'RPL7', log2fc: 1.2, padj: 0.019 },
    { id: 'EIF4E', symbol: 'EIF4E', log2fc: 1.6, padj: 0.007 },
    { id: 'EIF4G1', symbol: 'EIF4G1', log2fc: 1.4, padj: 0.011 },
    { id: 'EEF1A1', symbol: 'EEF1A1', log2fc: 1.1, padj: 0.022 },
    { id: 'EEF2', symbol: 'EEF2', log2fc: 1.3, padj: 0.016 },
    { id: 'PABP1', symbol: 'PABP1', log2fc: 1.2, padj: 0.020 },
    
    // DNA repair genes (up-regulated)
    { id: 'BRCA1', symbol: 'BRCA1', log2fc: 1.5, padj: 0.010 },
    { id: 'BRCA2', symbol: 'BRCA2', log2fc: 1.3, padj: 0.017 },
    { id: 'ATM', symbol: 'ATM', log2fc: 1.4, padj: 0.013 },
    { id: 'ATR', symbol: 'ATR', log2fc: 1.2, padj: 0.021 },
    { id: 'CHEK1', symbol: 'CHEK1', log2fc: 1.6, padj: 0.008 },
    { id: 'CHEK2', symbol: 'CHEK2', log2fc: 1.1, padj: 0.024 },
    { id: 'RAD51', symbol: 'RAD51', log2fc: 1.3, padj: 0.015 },
    
    // Spliceosome genes (mixed)
    { id: 'SNRNP70', symbol: 'SNRNP70', log2fc: -1.2, padj: 0.020 },
    { id: 'SF3B1', symbol: 'SF3B1', log2fc: -1.4, padj: 0.012 },
    { id: 'U2AF1', symbol: 'U2AF1', log2fc: -1.1, padj: 0.026 },
    { id: 'SRSF1', symbol: 'SRSF1', log2fc: 1.2, padj: 0.019 },
    { id: 'HNRNPA1', symbol: 'HNRNPA1', log2fc: 1.1, padj: 0.025 },
    { id: 'PRPF8', symbol: 'PRPF8', log2fc: -1.3, padj: 0.016 },
    { id: 'LSM2', symbol: 'LSM2', log2fc: -1.1, padj: 0.027 },
    
    // Cytokine signaling (up-regulated)
    { id: 'IL1A', symbol: 'IL1A', log2fc: 2.0, padj: 0.002 },
    { id: 'IL1B', symbol: 'IL1B', log2fc: 2.2, padj: 0.001 },
    { id: 'IL6', symbol: 'IL6', log2fc: 2.4, padj: 0.0003 },
    { id: 'IFNA1', symbol: 'IFNA1', log2fc: 1.8, padj: 0.004 },
    { id: 'TGFB1', symbol: 'TGFB1', log2fc: 1.3, padj: 0.014 },
    
    // MYC targets (down-regulated)
    { id: 'MYC', symbol: 'MYC', log2fc: -1.9, padj: 0.003 },
    { id: 'CCND2', symbol: 'CCND2', log2fc: -1.5, padj: 0.010 },
    { id: 'RRM2', symbol: 'RRM2', log2fc: -1.7, padj: 0.005 },
    { id: 'TK1', symbol: 'TK1', log2fc: -1.3, padj: 0.016 },
    { id: 'TYMS', symbol: 'TYMS', log2fc: -1.4, padj: 0.013 },
    { id: 'DHFR', symbol: 'DHFR', log2fc: -1.2, padj: 0.021 },
    
    // Oxidative phosphorylation (down-regulated)
    { id: 'COX4I1', symbol: 'COX4I1', log2fc: -1.1, padj: 0.026 },
    { id: 'COX5A', symbol: 'COX5A', log2fc: -1.3, padj: 0.017 },
    { id: 'COX6A1', symbol: 'COX6A1', log2fc: -1.2, padj: 0.022 },
    { id: 'ATP5A1', symbol: 'ATP5A1', log2fc: -1.4, padj: 0.014 },
    { id: 'ATP5B', symbol: 'ATP5B', log2fc: -1.1, padj: 0.028 },
    { id: 'NDUFA1', symbol: 'NDUFA1', log2fc: -1.2, padj: 0.023 },
    { id: 'NDUFB1', symbol: 'NDUFB1', log2fc: -1.3, padj: 0.018 },
    
    // Non-significant genes
    { id: 'ACTB', symbol: 'ACTB', log2fc: 0.1, padj: 0.95 },
    { id: 'GAPDH', symbol: 'GAPDH', log2fc: -0.2, padj: 0.87 },
    { id: 'TUBB', symbol: 'TUBB', log2fc: 0.3, padj: 0.73 },
    { id: 'HSP90AA1', symbol: 'HSP90AA1', log2fc: 0.4, padj: 0.68 },
    { id: 'PPIA', symbol: 'PPIA', log2fc: -0.1, padj: 0.91 },
];

// Background genes (all genes that were measured)
export const BACKGROUND_GENES: Gene[] = [
    ...SAMPLE_GENES,
    // Add more background genes that weren't differentially expressed
    { id: 'ALB', symbol: 'ALB', log2fc: 0.05, padj: 0.95 },
    { id: 'INS', symbol: 'INS', log2fc: -0.1, padj: 0.89 },
    { id: 'APOE', symbol: 'APOE', log2fc: 0.2, padj: 0.78 },
    { id: 'TTN', symbol: 'TTN', log2fc: 0.1, padj: 0.84 },
    { id: 'MUC1', symbol: 'MUC1', log2fc: -0.3, padj: 0.65 },
    // ... many more would be in a real dataset
];

/**
 * Get a subset of sample data for testing
 */
export function getSampleData(size: number = 50): Gene[] {
    return SAMPLE_GENES.slice(0, size);
}

/**
 * Get background data for testing
 */
export function getBackgroundData(): Gene[] {
    return BACKGROUND_GENES;
}
