<script lang="ts">
    import { onMount } from 'svelte';
    import type { Gene, ORAResult, ORAParameters } from '../../../utils/ora';
    import { runORA, extractDifferentialGenes, exportORAResultsCSV, DEFAULT_ORA_PARAMS } from '../../../utils/ora';
    import { getAllGeneSets, getGeneSetsByCategory } from '../../../utils/geneSets';

    // Props
    let { 
        genes, 
        title = "Over-representation Analysis",
        backgroundGenes
    }: { 
        genes: Gene[];
        title?: string;
        backgroundGenes?: Gene[];
    } = $props();

    // State
    let oraResults: ORAResult[] = $state([]);
    let upResults: ORAResult[] = $state([]);
    let downResults: ORAResult[] = $state([]);
    let selectedCategory: 'GO' | 'KEGG' | 'Hallmark' | 'All' = $state('All');
    let selectedDirection: 'Up' | 'Down' | 'Both' = $state('Both');
    let isLoading = $state(false);
    let error = $state('');
    let maxResults = $state(15);
    let sortBy: 'pValue' | 'adjustedPValue' | 'enrichmentRatio' = $state('adjustedPValue');
    let showParameters = $state(false);

    // Parameters (reactive)
    let params: ORAParameters = $state({ ...DEFAULT_ORA_PARAMS });

    // Computed
    let displayResults = $derived.by(() => {
        let results: ORAResult[] = [];
        
        if (selectedDirection === 'Both') {
            results = [...upResults, ...downResults];
        } else if (selectedDirection === 'Up') {
            results = upResults;
        } else {
            results = downResults;
        }

        // Filter by category
        if (selectedCategory !== 'All') {
            results = results.filter(r => r.category === selectedCategory);
        }

        // Sort
        results.sort((a, b) => {
            switch (sortBy) {
                case 'pValue':
                    return a.pValue - b.pValue;
                case 'adjustedPValue':
                    return a.adjustedPValue - b.adjustedPValue;
                case 'enrichmentRatio':
                    return b.enrichmentRatio - a.enrichmentRatio;
                default:
                    return a.adjustedPValue - b.adjustedPValue;
            }
        });

        return results.slice(0, maxResults);
    });

    // Methods
    async function runAnalysis() {
        if (!genes || genes.length === 0) {
            error = 'No genes provided for analysis';
            return;
        }

        isLoading = true;
        error = '';
        
        try {
            // Extract differential genes
            const { upGenes, downGenes } = extractDifferentialGenes(genes, params);
            
            if (upGenes.length < params.minGenes && downGenes.length < params.minGenes) {
                error = `Not enough differential genes found. Need at least ${params.minGenes} genes.`;
                isLoading = false;
                return;
            }

            // Get gene sets
            const geneSets = getAllGeneSets();
            
            // Use provided background or all genes
            const background = backgroundGenes || genes;

            // Run ORA for up and down genes
            if (upGenes.length >= params.minGenes) {
                upResults = await runORA(upGenes, geneSets, background, params);
            }
            
            if (downGenes.length >= params.minGenes) {
                downResults = await runORA(downGenes, geneSets, background, params);
            }

            console.log(`ORA completed: ${upResults.length} up-regulated terms, ${downResults.length} down-regulated terms`);
            
        } catch (err) {
            error = err instanceof Error ? err.message : 'An error occurred during analysis';
            console.error('ORA Error:', err);
        } finally {
            isLoading = false;
        }
    }

    function downloadCSV(direction: 'up' | 'down' | 'all') {
        let results: ORAResult[] = [];
        let filename = '';
        
        switch (direction) {
            case 'up':
                results = upResults;
                filename = 'ora_upregulated.csv';
                break;
            case 'down':
                results = downResults;
                filename = 'ora_downregulated.csv';
                break;
            case 'all':
                results = [...upResults, ...downResults];
                filename = 'ora_all_results.csv';
                break;
        }

        if (results.length === 0) {
            alert('No results to download');
            return;
        }

        const csv = exportORAResultsCSV(results);
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function getCategoryColor(category: string): string {
        switch (category) {
            case 'GO': return '#4CAF50';
            case 'KEGG': return '#2196F3';
            case 'Hallmark': return '#FF9800';
            default: return '#9E9E9E';
        }
    }

    function formatPValue(pValue: number): string {
        if (pValue < 0.001) {
            return pValue.toExponential(2);
        }
        return pValue.toFixed(4);
    }

    // Auto-run analysis when genes change
    $effect(() => {
        if (genes && genes.length > 0) {
            runAnalysis();
        }
    });
</script>

<div class="ora-container">
    <div class="ora-header">
        <h3>{title}</h3>
        <div class="controls">
            <button 
                onclick={() => showParameters = !showParameters}
                class="toggle-params-btn"
            >
                ⚙️ Parameters
            </button>
            <button 
                onclick={() => runAnalysis()} 
                disabled={isLoading}
                class="run-btn"
            >
                {isLoading ? '⏳ Running...' : '🔄 Re-run Analysis'}
            </button>
        </div>
    </div>

    {#if showParameters}
        <div class="parameters-panel">
            <h4>Analysis Parameters</h4>
            <div class="param-grid">
                <div class="param-item">
                    <label for="primary-lfc">Log2 Fold Change Threshold:</label>
                    <input 
                        id="primary-lfc"
                        type="number" 
                        bind:value={params.primaryLfc}
                        step="0.1" 
                        min="0"
                    />
                </div>
                <div class="param-item">
                    <label for="padj-cutoff">P-adj Cutoff:</label>
                    <input 
                        id="padj-cutoff"
                        type="number" 
                        bind:value={params.padjCutoff}
                        step="0.01" 
                        min="0" 
                        max="1"
                    />
                </div>
                <div class="param-item">
                    <label for="relaxed-padj">Relaxed P-adj Cutoff:</label>
                    <input 
                        id="relaxed-padj"
                        type="number" 
                        bind:value={params.relaxedPadjCutoff}
                        step="0.01" 
                        min="0" 
                        max="1"
                    />
                </div>
                <div class="param-item">
                    <label for="min-genes">Min Genes:</label>
                    <input 
                        id="min-genes"
                        type="number" 
                        bind:value={params.minGenes}
                        step="1" 
                        min="1"
                    />
                </div>
                <div class="param-item">
                    <label for="ora-pvalue">ORA P-value Cutoff:</label>
                    <input 
                        id="ora-pvalue"
                        type="number" 
                        bind:value={params.adjustedPvalueCutoff}
                        step="0.01" 
                        min="0" 
                        max="1"
                    />
                </div>
            </div>
        </div>
    {/if}

    {#if error}
        <div class="error-message">
            <strong>Error:</strong> {error}
        </div>
    {/if}

    <div class="filters">
        <div class="filter-group">
            <label for="category-select">Category:</label>
            <select id="category-select" bind:value={selectedCategory}>
                <option value="All">All Categories</option>
                <option value="GO">Gene Ontology</option>
                <option value="KEGG">KEGG Pathways</option>
                <option value="Hallmark">Hallmark Gene Sets</option>
            </select>
        </div>

        <div class="filter-group">
            <label for="direction-select">Direction:</label>
            <select id="direction-select" bind:value={selectedDirection}>
                <option value="Both">Both Up & Down</option>
                <option value="Up">Up-regulated</option>
                <option value="Down">Down-regulated</option>
            </select>
        </div>

        <div class="filter-group">
            <label for="sort-select">Sort by:</label>
            <select id="sort-select" bind:value={sortBy}>
                <option value="adjustedPValue">Adjusted P-value</option>
                <option value="pValue">P-value</option>
                <option value="enrichmentRatio">Enrichment Ratio</option>
            </select>
        </div>

        <div class="filter-group">
            <label for="max-results">Max Results:</label>
            <input 
                id="max-results"
                type="number" 
                bind:value={maxResults}
                min="5" 
                max="100" 
                step="5"
            />
        </div>
    </div>

    <div class="download-buttons">
        <button onclick={() => downloadCSV('up')} disabled={upResults.length === 0}>
            📊 Download Up-regulated CSV ({upResults.length})
        </button>
        <button onclick={() => downloadCSV('down')} disabled={downResults.length === 0}>
            📊 Download Down-regulated CSV ({downResults.length})
        </button>
        <button onclick={() => downloadCSV('all')} disabled={upResults.length + downResults.length === 0}>
            📊 Download All CSV ({upResults.length + downResults.length})
        </button>
    </div>

    <div class="results-container">
        {#if isLoading}
            <div class="loading">
                <div class="spinner"></div>
                <p>Running Over-representation Analysis...</p>
            </div>
        {:else if displayResults.length === 0}
            <div class="no-results">
                <p>No significant enriched terms found.</p>
                <p>Try adjusting the parameters or using different gene sets.</p>
            </div>
        {:else}
            <div class="results-table">
                <h4>Enriched Gene Sets ({displayResults.length} results)</h4>
                <table>
                    <thead>
                        <tr>
                            <th>Gene Set</th>
                            <th>Category</th>
                            <th>Description</th>
                            <th>P-value</th>
                            <th>Adj. P-value</th>
                            <th>Gene Ratio</th>
                            <th>Enrichment</th>
                            <th>Genes</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each displayResults as result}
                            <tr>
                                <td class="gene-set-name">
                                    <span 
                                        class="category-indicator" 
                                        style="background-color: {getCategoryColor(result.category)}"
                                    ></span>
                                    <strong>{result.geneSetName}</strong>
                                </td>
                                <td class="category">
                                    {result.category}
                                    {#if result.subcategory}
                                        <br><small>{result.subcategory}</small>
                                    {/if}
                                </td>
                                <td class="description">{result.description}</td>
                                <td class="p-value">{formatPValue(result.pValue)}</td>
                                <td class="adj-p-value">{formatPValue(result.adjustedPValue)}</td>
                                <td class="gene-ratio">{result.geneRatio}</td>
                                <td class="enrichment">{result.enrichmentRatio.toFixed(2)}</td>
                                <td class="genes">
                                    <details>
                                        <summary>{result.geneCount} genes</summary>
                                        <div class="gene-list">
                                            {result.geneSymbols.join(', ')}
                                        </div>
                                    </details>
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        {/if}
    </div>
</div>

<style>
    .ora-container {
        padding: 20px;
        max-width: 100%;
        font-family: 'Inconsolata', monospace;
    }

    .ora-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
    }

    .ora-header h3 {
        margin: 0;
        color: var(--text-color);
    }

    .controls {
        display: flex;
        gap: 10px;
    }

    .toggle-params-btn, .run-btn {
        padding: 8px 16px;
        background: var(--primary-color);
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-family: inherit;
    }

    .toggle-params-btn:hover, .run-btn:hover:not(:disabled) {
        background: var(--primary-color-dark);
    }

    .run-btn:disabled {
        background: #ccc;
        cursor: not-allowed;
    }

    .parameters-panel {
        background: var(--background-secondary);
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 20px;
        border: 1px solid var(--border-color);
    }

    .parameters-panel h4 {
        margin-top: 0;
        color: var(--text-color);
    }

    .param-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 15px;
    }

    .param-item {
        display: flex;
        flex-direction: column;
    }

    .param-item label {
        margin-bottom: 5px;
        font-weight: 500;
        color: var(--text-color);
    }

    .param-item input {
        padding: 8px;
        border: 1px solid var(--border-color);
        border-radius: 4px;
        background: var(--background-color);
        color: var(--text-color);
        font-family: inherit;
    }

    .error-message {
        background: #fee;
        border: 1px solid #fcc;
        padding: 10px;
        border-radius: 4px;
        margin-bottom: 20px;
        color: #d00;
    }

    .filters {
        display: flex;
        gap: 20px;
        margin-bottom: 20px;
        flex-wrap: wrap;
    }

    .filter-group {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .filter-group label {
        font-weight: 500;
        color: var(--text-color);
    }

    .filter-group select, .filter-group input {
        padding: 6px;
        border: 1px solid var(--border-color);
        border-radius: 4px;
        background: var(--background-color);
        color: var(--text-color);
        font-family: inherit;
    }

    .download-buttons {
        display: flex;
        gap: 10px;
        margin-bottom: 20px;
        flex-wrap: wrap;
    }

    .download-buttons button {
        padding: 8px 16px;
        background: var(--secondary-color);
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-family: inherit;
    }

    .download-buttons button:hover:not(:disabled) {
        background: var(--secondary-color-dark);
    }

    .download-buttons button:disabled {
        background: #ccc;
        cursor: not-allowed;
    }

    .loading {
        text-align: center;
        padding: 40px;
        color: var(--text-color);
    }

    .spinner {
        border: 4px solid #f3f3f3;
        border-top: 4px solid var(--primary-color);
        border-radius: 50%;
        width: 30px;
        height: 30px;
        animation: spin 1s linear infinite;
        margin: 0 auto 20px;
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }

    .no-results {
        text-align: center;
        padding: 40px;
        color: var(--text-color-secondary);
    }

    .results-table {
        overflow-x: auto;
    }

    .results-table h4 {
        margin-bottom: 15px;
        color: var(--text-color);
    }

    table {
        width: 100%;
        border-collapse: collapse;
        background: var(--background-color);
    }

    th, td {
        padding: 12px 8px;
        text-align: left;
        border-bottom: 1px solid var(--border-color);
        color: var(--text-color);
    }

    th {
        background: var(--background-secondary);
        font-weight: 600;
        position: sticky;
        top: 0;
    }

    .gene-set-name {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .category-indicator {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        flex-shrink: 0;
    }

    .description {
        max-width: 300px;
        font-size: 0.9em;
    }

    .p-value, .adj-p-value {
        font-family: monospace;
    }

    .gene-ratio, .enrichment {
        text-align: center;
    }

    .genes details {
        cursor: pointer;
    }

    .genes summary {
        color: var(--primary-color);
        font-weight: 500;
    }

    .gene-list {
        margin-top: 8px;
        padding: 8px;
        background: var(--background-secondary);
        border-radius: 4px;
        font-size: 0.9em;
        max-width: 250px;
        word-wrap: break-word;
    }

    /* Responsive design */
    @media (max-width: 768px) {
        .filters {
            flex-direction: column;
            gap: 10px;
        }

        .filter-group {
            flex-direction: column;
            align-items: flex-start;
        }

        .param-grid {
            grid-template-columns: 1fr;
        }

        .ora-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
        }

        .download-buttons {
            flex-direction: column;
        }
    }
</style>
