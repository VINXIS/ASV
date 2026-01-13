<script lang="ts">
    import ORAAnalysis from './oraAnalysis.svelte';
    import { getSampleData, getBackgroundData } from '../../utils/sampleData';

    // State
    let showDemo = $state(false);
    let sampleSize = $state(30);
    
    // Sample data
    let sampleGenes = $derived(() => getSampleData(sampleSize));
    let backgroundGenes = getBackgroundData();
</script>

<div class="ora-demo-container">
    <div class="demo-header">
        <h3>🧬 Over-representation Analysis Demo</h3>
        <p>
            Analyze gene sets for functional enrichment in your differential expression data.
            This demo uses sample gene expression data to demonstrate ORA functionality.
        </p>
        
        <div class="demo-controls">
            <button 
                onclick={() => showDemo = !showDemo}
                class="demo-toggle"
            >
                {showDemo ? '🔼 Hide Demo' : '🔽 Show Demo'}
            </button>
            
            {#if showDemo}
                <div class="sample-controls">
                    <label>
                        Sample size: 
                        <input 
                            type="range" 
                            bind:value={sampleSize}
                            min="10" 
                            max="60" 
                            step="5"
                        />
                        <span>{sampleSize} genes</span>
                    </label>
                </div>
            {/if}
        </div>
    </div>

    {#if showDemo}
        <div class="demo-content">
            <div class="demo-info">
                <h4>📊 Sample Data Information</h4>
                <div class="info-grid">
                    <div class="info-item">
                        <strong>Total Genes:</strong> {sampleGenes().length}
                    </div>
                    <div class="info-item">
                        <strong>Background:</strong> {backgroundGenes.length} genes
                    </div>
                    <div class="info-item">
                        <strong>Up-regulated:</strong> {sampleGenes().filter((g: any) => g.log2fc && g.log2fc > 1 && g.padj && g.padj < 0.05).length}
                    </div>
                    <div class="info-item">
                        <strong>Down-regulated:</strong> {sampleGenes().filter((g: any) => g.log2fc && g.log2fc < -1 && g.padj && g.padj < 0.05).length}
                    </div>
                </div>
                
                <div class="gene-sets-info">
                    <h5>Available Gene Sets:</h5>
                    <ul>
                        <li><strong>Gene Ontology (GO):</strong> Biological processes like immune response, translation, DNA repair</li>
                        <li><strong>KEGG Pathways:</strong> Cell cycle, apoptosis, cytokine signaling, spliceosome</li>
                        <li><strong>Hallmark Gene Sets:</strong> Inflammatory response, p53 pathway, MYC targets, oxidative phosphorylation</li>
                    </ul>
                </div>
            </div>

            <ORAAnalysis 
                data={sampleGenes()}
                backgroundGenes={backgroundGenes}
                title="Sample Gene Expression ORA"
            />
        </div>
    {/if}
</div>

<style>
    .ora-demo-container {
        margin: 20px 0;
        font-family: 'Inconsolata', monospace;
    }

    .demo-header {
        background: var(--background-secondary);
        padding: 20px;
        border-radius: 8px 8px 0 0;
        border: 1px solid var(--border-color);
    }

    .demo-header h3 {
        margin: 0 0 10px 0;
        color: var(--text-color);
        font-size: 20px;
    }

    .demo-header p {
        margin: 0 0 15px 0;
        color: var(--text-color-secondary);
        line-height: 1.5;
    }

    .demo-controls {
        display: flex;
        align-items: center;
        gap: 20px;
        flex-wrap: wrap;
    }

    .demo-toggle {
        background: var(--primary-color);
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-family: inherit;
        font-weight: 500;
        transition: background 0.2s ease;
    }

    .demo-toggle:hover {
        background: var(--primary-color-dark, #0056b3);
    }

    .sample-controls {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .sample-controls label {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--text-color);
        font-weight: 500;
    }

    .sample-controls input[type="range"] {
        width: 120px;
    }

    .sample-controls span {
        font-size: 14px;
        color: var(--text-color-secondary);
        min-width: 60px;
    }

    .demo-content {
        border: 1px solid var(--border-color);
        border-top: none;
        border-radius: 0 0 8px 8px;
        overflow: hidden;
    }

    .demo-info {
        background: var(--background-color);
        padding: 20px;
        border-bottom: 1px solid var(--border-color);
    }

    .demo-info h4 {
        margin: 0 0 15px 0;
        color: var(--text-color);
        font-size: 16px;
    }

    .demo-info h5 {
        margin: 15px 0 8px 0;
        color: var(--text-color);
        font-size: 14px;
    }

    .info-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 12px;
        margin-bottom: 15px;
    }

    .info-item {
        padding: 8px 12px;
        background: var(--background-secondary);
        border-radius: 4px;
        font-size: 14px;
        color: var(--text-color-secondary);
    }

    .info-item strong {
        color: var(--text-color);
    }

    .gene-sets-info ul {
        margin: 0;
        padding-left: 20px;
        color: var(--text-color-secondary);
    }

    .gene-sets-info li {
        margin-bottom: 5px;
        line-height: 1.4;
    }

    .gene-sets-info strong {
        color: var(--text-color);
    }

    /* Responsive */
    @media (max-width: 768px) {
        .demo-header {
            padding: 15px;
        }
        
        .demo-controls {
            flex-direction: column;
            align-items: flex-start;
        }
        
        .info-grid {
            grid-template-columns: 1fr;
        }
        
        .demo-info {
            padding: 15px;
        }
    }
</style>
