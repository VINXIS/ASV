<script lang="ts">
    import { settings, getChromosomeList, resetSettings, getStrains, updateFilteredStrains, updateSelectFilteredStrains, shuffleColours } from "./state.svelte";
</script>

{#if getStrains().length > 0}
    <div id="controls">
        <div class="control-group">
            <label for="splicing-type">Alternative Splicing Type:</label>
            <select
                id="splicing-type"
                bind:value={settings.selectedEvent}
                onchange={() => updateSelectFilteredStrains()}
            >
                <option value="All">All</option>
                <option value="A3SS">A3SS (Alternative 3' Splice Site)</option>
                <option value="A5SS">A5SS (Alternative 5' Splice Site)</option>
                <option value="MXE">MXE (Mutually Exclusive Exons)</option>
                <option value="RI">RI (Retained Intron)</option>
                <option value="SE">SE (Skipped Exon)</option>
            </select>
        </div>

        <div class="control-group">
            <label for="chromosome">Chromosome:</label>
            <select
                id="chromosome"
                bind:value={settings.selectedChr}
                onchange={() => updateSelectFilteredStrains()}
            >
                {#each getChromosomeList() as chromosome}
                    <option value={chromosome}>{chromosome}</option>
                {/each}
            </select>
        </div>

        <div class="control-group">
            <label for="junction">Junction Read Type:</label>
            <select
                id="junction"
                bind:value={settings.selectedJunctionView}
                onchange={() => updateSelectFilteredStrains()}
            >
                <option value="JC">Junction Reads Only (JC)</option>
                <option value="JCEC">Junction + Exon Reads (JCEC)</option>
            </select>
        </div>

        <div class="control-group">
            <label for="readcount">Read Count Min Threshold:</label>
            <input
                type="range"
                id="readcount"
                min="0"
                max="1000"
                step="1"
                bind:value={settings.readCountThresh}
                oninput={() => updateFilteredStrains()}
            />
            <span>{settings.readCountThresh}</span>
        </div>

        <div class="control-group">
            <label for="fdrthreshold">FDR Threshold:</label>
            <input
                type="range"
                id="fdrthreshold"
                min="0"
                max="1"
                step="0.01"
                bind:value={settings.FDRThresh}
                oninput={() => updateFilteredStrains()}
            />
            <span>{settings.FDRThresh}</span>
        </div>

        <div class="control-group">
            <label for="incLevelThreshold">Inc Level Difference (ΔΨ) Threshold:</label>
            <input
                type="range"
                id="incLevelThreshold"
                min="0"
                max="1"
                step="0.01"
                bind:value={settings.psiDiffThresh}
                oninput={() => updateFilteredStrains()}
            />
            <span>{settings.psiDiffThresh}</span>
        </div>

        <div class="control-group">
            <label for="limit">Limit PSI values to within 0.05-0.95:</label>
            <input
                type="checkbox"
                id="limit"
                bind:checked={settings.extraneousPsiLimits}
                onchange={() => updateSelectFilteredStrains()}
            />
        </div>

        <button
            onclick={() => resetSettings()}
        >
            Reset Settings
        </button>

        <button
            onclick={() => shuffleColours()}
        >
            Shuffle Colours
        </button>
    </div>
{/if}

<style>
    #controls {
        margin-bottom: 20px;
        padding: 10px;
        border-radius: 5px;
    }

    .control-group {
        margin-bottom: 10px;
    }
</style>