/**
 * Over-representation Analysis (ORA) utilities
 * Based on R clusterProfiler functionality, adapted for web use
 */

export interface Gene {
    id: string;
    symbol: string;
    entrezId?: string;
    log2fc?: number;
    padj?: number;
}

export interface GeneSet {
    id: string;
    name: string;
    description: string;
    genes: string[]; // Gene IDs or symbols
    category: 'GO' | 'KEGG' | 'Hallmark' | 'Custom';
    subcategory?: string; // e.g., 'BP', 'MF', 'CC' for GO
}

export interface ORAResult {
    geneSetId: string;
    geneSetName: string;
    description: string;
    category: string;
    subcategory?: string;
    pValue: number;
    adjustedPValue: number;
    geneRatio: string; // e.g., "5/100"
    bgRatio: string; // e.g., "200/20000"
    enrichmentRatio: number;
    geneCount: number;
    genes: string[]; // Genes in the intersection
    geneSymbols: string[]; // Human readable gene symbols
}

export interface ORAParameters {
    primaryLfc: number;
    padjCutoff: number;
    relaxedPadjCutoff: number;
    minGenes: number;
    maxGenes?: number;
    pvalueCutoff: number;
    adjustedPvalueCutoff: number;
}

export const DEFAULT_ORA_PARAMS: ORAParameters = {
    primaryLfc: 1.0,
    padjCutoff: 0.05,
    relaxedPadjCutoff: 0.10,
    minGenes: 10,
    maxGenes: 500,
    pvalueCutoff: 0.05,
    adjustedPvalueCutoff: 0.05
};

/**
 * Extract up-regulated and down-regulated genes based on thresholds
 */
export function extractDifferentialGenes(
    genes: Gene[], 
    params: ORAParameters = DEFAULT_ORA_PARAMS
): { upGenes: Gene[], downGenes: Gene[] } {
    
    // Primary filtering
    let upGenes = genes.filter(g => 
        g.log2fc !== undefined && g.padj !== undefined &&
        g.log2fc >= params.primaryLfc && g.padj <= params.padjCutoff
    );
    
    let downGenes = genes.filter(g => 
        g.log2fc !== undefined && g.padj !== undefined &&
        g.log2fc <= -params.primaryLfc && g.padj <= params.padjCutoff
    );
    
    // Relaxed filtering if too few genes
    if (upGenes.length < params.minGenes) {
        upGenes = genes.filter(g => 
            g.log2fc !== undefined && g.padj !== undefined &&
            g.log2fc >= params.primaryLfc && g.padj <= params.relaxedPadjCutoff
        );
    }
    
    if (downGenes.length < params.minGenes) {
        downGenes = genes.filter(g => 
            g.log2fc !== undefined && g.padj !== undefined &&
            g.log2fc <= -params.primaryLfc && g.padj <= params.relaxedPadjCutoff
        );
    }
    
    return { upGenes, downGenes };
}

/**
 * Perform hypergeometric test for over-representation
 */
function hypergeometricTest(
    k: number,  // genes in intersection
    n: number,  // total genes in gene set
    K: number,  // genes in our query list
    N: number   // total genes in background
): number {
    // This is a simplified p-value calculation
    // For production, you might want to use a proper statistical library
    
    if (k === 0) return 1.0;
    
    // Calculate hypergeometric probability
    // P(X >= k) where X ~ Hypergeometric(N, n, K)
    
    const expectedOverlap = (n * K) / N;
    const enrichmentRatio = k / expectedOverlap;
    
    if (enrichmentRatio <= 1) return 1.0;
    
    // Simplified approximation - replace with proper hypergeometric test
    // This is just for demonstration
    const z = (k - expectedOverlap) / Math.sqrt(expectedOverlap * (1 - n/N) * (1 - K/N));
    const pValue = Math.max(0.001, Math.min(1.0, 2 * (1 - normalCDF(Math.abs(z)))));
    
    return pValue;
}

/**
 * Simple normal CDF approximation
 */
function normalCDF(x: number): number {
    return 0.5 * (1 + erf(x / Math.sqrt(2)));
}

/**
 * Error function approximation
 */
function erf(x: number): number {
    // Abramowitz and Stegun approximation
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;
    
    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);
    
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    
    return sign * y;
}

/**
 * Benjamini-Hochberg FDR correction
 */
function adjustPValues(pValues: number[]): number[] {
    const n = pValues.length;
    const indices = Array.from({length: n}, (_, i) => i);
    
    // Sort by p-value
    indices.sort((a, b) => pValues[a] - pValues[b]);
    
    const adjustedPValues = new Array(n);
    let minAdjusted = 1.0;
    
    // Calculate adjusted p-values from largest to smallest
    for (let i = n - 1; i >= 0; i--) {
        const idx = indices[i];
        const adjustedP = Math.min(minAdjusted, pValues[idx] * n / (i + 1));
        adjustedPValues[idx] = adjustedP;
        minAdjusted = adjustedP;
    }
    
    return adjustedPValues;
}

/**
 * Run Over-representation Analysis
 */
export function runORA(
    queryGenes: Gene[],
    geneSets: GeneSet[],
    backgroundGenes: Gene[],
    params: ORAParameters = DEFAULT_ORA_PARAMS
): ORAResult[] {
    
    if (queryGenes.length < params.minGenes) {
        return [];
    }
    
    const queryGeneIds = new Set(queryGenes.map(g => g.symbol || g.id));
    const backgroundGeneIds = new Set(backgroundGenes.map(g => g.symbol || g.id));
    const N = backgroundGeneIds.size;
    const K = queryGeneIds.size;
    
    const results: Array<ORAResult & { rawPValue: number }> = [];
    
    for (const geneSet of geneSets) {
        // Find intersection of query genes with gene set
        const geneSetIds = new Set(geneSet.genes);
        const intersection = Array.from(queryGeneIds).filter(id => geneSetIds.has(id));
        
        if (intersection.length === 0) continue;
        
        // Calculate gene set size (genes that are also in background)
        const geneSetInBackground = geneSet.genes.filter(id => backgroundGeneIds.has(id));
        const n = geneSetInBackground.length;
        const k = intersection.length;
        
        if (n < params.minGenes) continue;
        
        // Hypergeometric test
        const pValue = hypergeometricTest(k, n, K, N);
        
        if (pValue > params.pvalueCutoff) continue;
        
        const enrichmentRatio = (k / K) / (n / N);
        
        results.push({
            geneSetId: geneSet.id,
            geneSetName: geneSet.name,
            description: geneSet.description,
            category: geneSet.category,
            subcategory: geneSet.subcategory,
            rawPValue: pValue,
            pValue: pValue,
            adjustedPValue: 0, // Will be calculated later
            geneRatio: `${k}/${K}`,
            bgRatio: `${n}/${N}`,
            enrichmentRatio: enrichmentRatio,
            geneCount: k,
            genes: intersection,
            geneSymbols: intersection // Assuming symbols are the same as IDs for now
        });
    }
    
    // Adjust p-values
    const rawPValues = results.map(r => r.rawPValue);
    const adjustedPValues = adjustPValues(rawPValues);
    
    results.forEach((result, i) => {
        result.adjustedPValue = adjustedPValues[i];
    });
    
    // Filter by adjusted p-value and sort
    return results
        .filter(r => r.adjustedPValue <= params.adjustedPvalueCutoff)
        .sort((a, b) => a.adjustedPValue - b.adjustedPValue);
}

/**
 * Export results to CSV format (returns CSV string)
 */
export function exportORAResultsCSV(results: ORAResult[]): string {
    if (results.length === 0) return '';
    
    const headers = [
        'Gene Set ID', 'Gene Set Name', 'Description', 'Category', 'Subcategory',
        'P Value', 'Adjusted P Value', 'Gene Ratio', 'Background Ratio', 
        'Enrichment Ratio', 'Gene Count', 'Genes'
    ];
    
    const csvRows = [headers.join(',')];
    
    for (const result of results) {
        const row = [
            result.geneSetId,
            `"${result.geneSetName}"`,
            `"${result.description}"`,
            result.category,
            result.subcategory || '',
            result.pValue.toExponential(3),
            result.adjustedPValue.toExponential(3),
            result.geneRatio,
            result.bgRatio,
            result.enrichmentRatio.toFixed(3),
            result.geneCount.toString(),
            `"${result.genes.join(';')}"`,
        ];
        csvRows.push(row.join(','));
    }
    
    return csvRows.join('\n');
}
