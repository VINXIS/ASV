# Over-representation Analysis (ORA) - Implementation Guide

## Overview

This implementation adds comprehensive Over-representation Analysis (ORA) functionality to your ASV (Alternative Splicing Visualizer) project, based on your professor's R implementation using clusterProfiler. The ORA analysis helps identify enriched biological pathways and gene sets in your differential expression data.

## 🎯 What was Added

### 1. Core ORA Engine (`utils/ora.ts`)
- **Gene and GeneSet interfaces**: TypeScript definitions for data structures
- **ORA computation**: Hypergeometric testing for enrichment analysis  
- **Multiple testing correction**: Benjamini-Hochberg FDR adjustment
- **Flexible gene filtering**: Primary and relaxed thresholds (like your professor's R code)
- **Export functionality**: CSV output for results

### 2. Gene Set Databases (`utils/geneSets.ts`)
- **Gene Ontology (GO)**: Biological processes like immune response, translation, DNA repair
- **KEGG Pathways**: Cell cycle, apoptosis, cytokine signaling, spliceosome
- **Hallmark Gene Sets**: Inflammatory response, p53 pathway, MYC targets, oxidative phosphorylation
- **Extensible design**: Easy to add more gene set databases

### 3. ORA Table Component (`src/components/charts/ora.svelte`)
- **Interactive analysis**: Run ORA with customizable parameters
- **Real-time filtering**: By category, direction (up/down), significance
- **Parameter controls**: Adjust thresholds, gene counts, p-value cutoffs
- **Results export**: Download CSV files for up/down/all results
- **Responsive design**: Works on desktop and mobile

### 4. ORA Dot Plot Visualization (`src/components/charts/oraDotPlot.svelte`)
- **Publication-ready plots**: Similar to R's dotplot() function
- **Interactive features**: Hover tooltips, clickable terms
- **Customizable display**: Color by p-value or enrichment ratio
- **Size encoding**: Dot size represents gene count
- **Legend system**: Clear visualization guides

### 5. Integrated Analysis Component (`src/components/oraAnalysis.svelte`)
- **Tabbed interface**: Switch between table and dot plot views
- **Data compatibility**: Works with both Event[] and Gene[] data types
- **Background gene support**: Proper statistical background

### 6. Demo Implementation (`src/components/oraDemo.svelte`)
- **Sample data**: Realistic gene expression dataset with known pathways
- **Interactive controls**: Adjust sample size, view statistics
- **Educational info**: Explains gene sets and analysis parameters

## 🔬 How It Works

### ORA Algorithm (Following Professor's R Implementation)

1. **Gene Selection**:
   ```typescript
   // Primary filtering (like R code)
   upGenes = genes.filter(g => g.log2fc >= 1.0 && g.padj <= 0.05)
   downGenes = genes.filter(g => g.log2fc <= -1.0 && g.padj <= 0.05)
   
   // Relaxed filtering if < minGenes (default: 10)
   if (upGenes.length < 10) {
     upGenes = genes.filter(g => g.log2fc >= 1.0 && g.padj <= 0.10)
   }
   ```

2. **Hypergeometric Testing**:
   ```typescript
   // For each gene set, test enrichment
   pValue = hypergeometricTest(
     k,  // genes in intersection (our genes ∩ gene set)
     n,  // total genes in gene set  
     K,  // total genes in our list
     N   // total background genes
   )
   ```

3. **Multiple Testing Correction**:
   ```typescript
   // Benjamini-Hochberg FDR adjustment (like R's p.adjust)
   adjustedPValues = benjaminiHochberg(pValues)
   ```

### Data Flow

```
Your Gene Data → ORA Analysis → Results Table/Dot Plot
     ↓              ↓              ↓
[Event[] or      Gene Set      Interactive
 Gene[]]         Database      Visualization
```

## 🚀 Usage Examples

### Basic Usage in Your Components

```typescript
import ORAAnalysis from './components/oraAnalysis.svelte';

// Use with your existing Event data
<ORAAnalysis 
  data={yourEventData}
  title="Alternative Splicing ORA"
/>

// Or with Gene data
<ORAAnalysis 
  data={yourGeneData}
  backgroundGenes={allMeasuredGenes}
  title="Differential Expression ORA"
/>
```

### Customizing Parameters

```typescript
// The ORA component allows customization of:
{
  primaryLfc: 1.0,           // Log2 fold-change threshold
  padjCutoff: 0.05,          // Primary p-adjusted cutoff
  relaxedPadjCutoff: 0.10,   // Relaxed cutoff if too few genes
  minGenes: 10,              // Minimum genes for analysis
  adjustedPvalueCutoff: 0.05 // ORA significance threshold
}
```

### Adding Custom Gene Sets

```typescript
// In utils/geneSets.ts
export const CUSTOM_PATHWAYS: GeneSet[] = [
  {
    id: 'CUSTOM_001',
    name: 'My Custom Pathway',
    description: 'Genes involved in my specific process',
    category: 'Custom',
    genes: ['GENE1', 'GENE2', 'GENE3', ...]
  }
];
```

## 📊 Expected Results

When you run the demo, you should see:

### Table View Results
- **Up-regulated terms**: Immune response, DNA repair, translation
- **Down-regulated terms**: Cell cycle, MYC targets, oxidative phosphorylation
- **Mixed terms**: Apoptosis (both up and down genes)

### Dot Plot Visualization
- **X-axis**: Enrichment ratio (how much more enriched than expected)
- **Y-axis**: Gene sets ordered by significance
- **Dot size**: Number of genes in intersection
- **Dot color**: P-value or enrichment ratio

## 🔧 Integration with Your Existing Data

### Converting Event Data to Gene Data

The system automatically converts your `Event[]` data:

```typescript
function convertEventsToGenes(events: Event[]): Gene[] {
  return events.map(event => ({
    id: event.eventId || event.geneName,
    symbol: event.geneName,
    log2fc: event.psiDiff,  // Using ΔΨ as fold change proxy
    padj: event.FDR
  }));
}
```

### Using Real Gene Expression Data

```typescript
// Your differential expression results
const deGenes: Gene[] = [
  { id: 'ENSG001', symbol: 'TP53', log2fc: 2.1, padj: 0.001 },
  { id: 'ENSG002', symbol: 'MYC', log2fc: -1.8, padj: 0.003 },
  // ... more genes
];

// Background (all measured genes)  
const backgroundGenes: Gene[] = [
  ...deGenes,
  // Add non-significant genes
  { id: 'ENSG999', symbol: 'ACTB', log2fc: 0.1, padj: 0.95 },
  // ... more background genes
];
```

## 📈 Next Steps

### Expanding Gene Set Databases

1. **Load from external APIs**:
   ```typescript
   // Connect to real databases
   const goTerms = await fetch('http://geneontology.org/api/...');
   const keggPathways = await fetch('https://rest.kegg.jp/...');
   ```

2. **Custom gene sets from files**:
   ```typescript
   // Load GMT files (like MSigDB format)
   const customSets = parseGMTFile(gmtFileContent);
   ```

### Enhanced Visualizations

1. **Pathway networks**: Show relationships between terms
2. **Gene-concept networks**: Connect genes to their pathways  
3. **Enrichment maps**: Cluster related pathways

### Statistical Improvements

1. **GSEA implementation**: Gene Set Enrichment Analysis
2. **Better p-value calculation**: Use exact hypergeometric distribution
3. **Effect size metrics**: Add more enrichment statistics

## 🎓 Educational Value

This implementation demonstrates:

- **Bioinformatics algorithms**: Hypergeometric testing, multiple testing correction
- **Web-based analysis**: Moving R/Bioconductor functionality to the browser
- **Interactive visualization**: Real-time exploration of biological data
- **Modern web development**: TypeScript, Svelte, reactive programming

The code closely follows your professor's R implementation while adapting it for web use, making it an excellent learning tool for understanding both the biological concepts and their computational implementation.

## 🐛 Troubleshooting

### Common Issues

1. **No results found**: Check that your gene symbols match the gene set databases
2. **Too few genes**: Adjust the `minGenes` parameter or `relaxedPadjCutoff` 
3. **Performance**: For large datasets, consider implementing web workers

### Debug Mode

Add console logging to track the analysis:

```typescript
console.log('Input genes:', genes.length);
console.log('Up-regulated:', upGenes.length);
console.log('Down-regulated:', downGenes.length);
console.log('ORA results:', oraResults.length);
```

## 📚 References

- **Original R Implementation**: Your professor's clusterProfiler-based code
- **clusterProfiler**: Yu et al. (2012) OMICS: A Journal of Integrative Biology
- **Gene Ontology**: Ashburner et al. (2000) Nature Genetics  
- **KEGG**: Kanehisa & Goto (2000) Nucleic Acids Research
- **MSigDB**: Liberzon et al. (2011) Bioinformatics

This implementation brings the power of R/Bioconductor's enrichment analysis to your web-based genomics visualization tool! 🧬✨
