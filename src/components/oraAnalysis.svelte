<script lang="ts">
    import ORATable from './charts/ora.svelte';
    import ORADotPlot from './charts/oraDotPlot.svelte';
    import type { Gene } from '../../utils/ora';
    import type { Event } from './states/strains';

    // Props - can accept either Event[] or Gene[]
    let { 
        data,
        title = "Over-representation Analysis",
        backgroundGenes
    }: { 
        data: Event[] | Gene[];
        title?: string;
        backgroundGenes?: Gene[];
    } = $props();

    // State
    let showDotPlot = $state(true);
    let oraResults = $state([]);

    // Convert Event data to Gene format
    function convertEventsToGenes(events: Event[]): Gene[] {
        return events.map(event => ({
            id: event.eventId || event.geneName,
            symbol: event.geneName,
            log2fc: event.psiDiff, // Using psiDiff as fold change proxy
            padj: event.FDR
        }));
    }

    // Determine if we have Events or Genes
    let genes = $derived(() => {
        if (!Array.isArray(data) || data.length === 0) return [] as Gene[];
        return 'eventId' in data[0] 
            ? convertEventsToGenes(data as Event[])
            : data as Gene[];
    });

    function handleResultsUpdate(results: any) {
        oraResults = results;
    }
</script>

<div class="ora-analysis-container">
    <div class="ora-tabs">
        <button 
            class="tab-button" 
            class:active={!showDotPlot}
            onclick={() => showDotPlot = false}
        >
            📊 Table View
        </button>
        <button 
            class="tab-button" 
            class:active={showDotPlot}
            onclick={() => showDotPlot = true}
        >
            🎯 Dot Plot
        </button>
    </div>

    <div class="ora-content">
        {#if !showDotPlot}
            <ORATable 
                genes={genes}
                {title}
                {backgroundGenes}
                bind:results={oraResults}
            />
        {:else}
            <div class="dot-plot-container">
                {#if oraResults.length === 0}
                    <div class="no-data-message">
                        <p>No ORA results to visualize.</p>
                        <p>Switch to Table View to run the analysis first.</p>
                    </div>
                {:else}
                    <ORADotPlot 
                        results={oraResults}
                        title={`${title} - Dot Plot`}
                    />
                {/if}
            </div>
        {/if}
    </div>
</div>

<style>
    .ora-analysis-container {
        width: 100%;
        font-family: 'Inconsolata', monospace;
        background: var(--background-color);
        border-radius: 8px;
        overflow: hidden;
        border: 1px solid var(--border-color);
    }

    .ora-tabs {
        display: flex;
        background: var(--background-secondary);
        border-bottom: 1px solid var(--border-color);
    }

    .tab-button {
        flex: 1;
        padding: 12px 16px;
        background: transparent;
        border: none;
        color: var(--text-color-secondary);
        font-family: inherit;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        border-bottom: 3px solid transparent;
    }

    .tab-button:hover {
        background: var(--background-color);
        color: var(--text-color);
    }

    .tab-button.active {
        color: var(--primary-color);
        border-bottom-color: var(--primary-color);
        background: var(--background-color);
    }

    .ora-content {
        min-height: 400px;
    }

    .dot-plot-container {
        padding: 20px;
    }

    .no-data-message {
        text-align: center;
        padding: 60px 20px;
        color: var(--text-color-secondary);
    }

    .no-data-message p {
        margin: 10px 0;
        font-size: 16px;
    }

    .no-data-message p:first-child {
        font-weight: 600;
        color: var(--text-color);
    }

    /* Responsive */
    @media (max-width: 768px) {
        .tab-button {
            padding: 10px 12px;
            font-size: 14px;
        }
        
        .dot-plot-container {
            padding: 15px;
        }
    }
</style>
