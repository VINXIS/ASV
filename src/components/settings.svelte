<script lang="ts">
    import { onMount } from "svelte";
    import { getSpeciesList, type EnsemblSpecies } from "./states/ensembl";
    import { getGtfList, importLocalGtf, type GtfInfo } from "./states/gtf";
    import { setSelectedEvent } from "./states/selectedEvent";
    import { settings } from "./states/settings";
    import { getChromosomeList, getFilteredStrains, getStrainLength, strainEventEmitter, updateFilteredStrains, updateSelectFilteredStrains, type Event as ASEvent } from "./states/strains";

    let speciesList: EnsemblSpecies[] = [];
    let gtfList: GtfInfo[] = [];
    let gtfError = "";
    let gtfImportMsg = "";
    let geneSearch = "";
    let results: {
        event: ASEvent;
        strain: {
            name: string;
            colour: string;
        };
    }[] = [];

    let existingStrains = false;
    let filteredStrains = getFilteredStrains().flatMap(s => s[1].events.map(e => ({
            event: e,
            strain: {
                name: s[0],
                colour: s[1].colour,
            }
        }))).sort((a, b) => a.event.geneName.localeCompare(b.event.geneName));
    strainEventEmitter.addEventListener("updateFilteredStrains", () => {
        existingStrains = getStrainLength() > 0;
        filteredStrains = getFilteredStrains().flatMap(s => s[1].events.map(e => ({
            event: e,
            strain: {
                name: s[0],
                colour: s[1].colour,
            }
        }))).sort((a, b) => a.event.geneName.localeCompare(b.event.geneName));
    });
    
    function resetSettings() {
        settings.selectedSpecies = "homo_sapiens";
        settings.selectedChr = "All";
        settings.selectedEventType = "All";

        settings.selectedGtfId = "";

        settings.readCountThresh = 10;
        settings.FDRThresh = 0.05;
        settings.psiDiffThresh = 0.2;
        settings.extraneousPsiLimits = false;

        updateSelectFilteredStrains();
    }

    async function handleGtfImport(event: globalThis.Event) {
        gtfImportMsg = "";
        gtfError = "";

        const input = event.currentTarget as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        try {
            const content = await file.text();
            const filenameBase = file.name.replace(/\.(gtf|gtf\.gz)$/i, "");
            const { uploadId, filename } = await importLocalGtf({ filenameBase, content });
            settings.selectedGtfId = uploadId;
            gtfImportMsg = `Loaded temporary GTF for this session: ${filename}`;
        } catch (e: any) {
            console.error(e);
            gtfError = e?.message ?? "Failed to import GTF";
        } finally {
            input.value = "";
        }
    }

    function searchGene() {
        const searchKey = geneSearch.trim().toLowerCase().replace(/\s+/g, "_");
        if (searchKey === "") {
            results = [];
            return;
        }
        results = filteredStrains.filter(event => {
            const geneName = event.event.geneName.toLowerCase().replace(/\s+/g, "_");
            const geneId = event.event.geneID.toLowerCase().replace(/\s+/g, "_");
            return geneName.includes(searchKey) || geneId.includes(searchKey);
        });
    }

    function select(gene: {
        event: ASEvent;
        strain: {
            name: string;
            colour: string;
        };
    }) {
        setSelectedEvent(gene);
        geneSearch = "";
        results = [];
    }

    function randomGene() {
        if (filteredStrains.length === 0) return;
        const randomIndex = Math.floor(Math.random() * filteredStrains.length);
        const randomGene = filteredStrains[randomIndex];
        setSelectedEvent(randomGene);
        geneSearch = "";
        results = [];
    }

    onMount(async () => {
        speciesList = await getSpeciesList();
        speciesList.sort((a, b) => a.display_name.localeCompare(b.display_name));

        try {
            gtfList = await getGtfList();
            gtfList.sort((a, b) => a.name.localeCompare(b.name));
        } catch (e) {
            console.error(e);
            gtfError = "Failed to load server GTF list";
            gtfList = [];
        }
    })

</script>

{#if existingStrains}
    <div id="controls">
        <div class="control-group">
            <label for="gene-search">Search for Gene:</label>
            <input
                type="text"
                id="gene-search"
                placeholder="Enter gene name/ID"
                bind:value={geneSearch}
                oninput={searchGene}
            />
            <div class="search-results">
                {#each results as gene}
                    <div
                        class="result-item"
                        onclick={() => select(gene)}
                        onkeydown={() => select(gene)}
                        tabindex="0"
                        role="button"
                    >
                        <span class="gene-name">{gene.event.geneName}</span>
                        <span class="gene-id">({gene.event.geneID})</span>
                        <span class="event-type">Type: {gene.event.eventType}</span>
                    </div>
                {/each}
            </div>
        </div>
        {#if filteredStrains.length > 0}
            <div class="control-group">
                <button
                    onclick={randomGene}
                >Select random gene</button>
            </div>
        {/if}

        <div class="control-group">
            <label for="species">Species:</label>
            <select
                id="species"
                bind:value={settings.selectedSpecies}
                onchange={() => {}}
            >
                {#each speciesList as species}
                    <option value={species.name}>{species.display_name} ({species.name}/{species.assembly})</option>
                {/each}
            </select>  
        </div>

        <div class="control-group">
            <label for="gtf">Server GTF Annotation:</label>
            <select id="gtf" bind:value={settings.selectedGtfId}>
                <option value="">None (Ensembl only)</option>
                {#if settings.selectedGtfId && settings.selectedGtfId.startsWith("session_")}
                    <option value={settings.selectedGtfId}>Uploaded (this session)</option>
                {/if}
                {#each gtfList as gtf}
                    <option value={gtf.id}>
                        {gtf.name}{gtf.species ? ` (${gtf.species}${gtf.assembly ? `/${gtf.assembly}` : ""})` : ""}
                    </option>
                {/each}
            </select>

            <div style="margin-top: 6px;">
                <label for="gtf-import">Import local GTF (optional):</label>
                <input id="gtf-import" type="file" accept=".gtf" onchange={handleGtfImport} />
                {#if gtfImportMsg}
                    <div class="info">{gtfImportMsg}</div>
                {/if}
                {#if gtfError}
                    <div class="error">{gtfError}</div>
                {/if}
            </div>
        </div>

        <div class="control-group">
            <label for="splicing-type">Alternative Splicing Type:</label>
            <select
                id="splicing-type"
                bind:value={settings.selectedEventType}
                onchange={updateSelectFilteredStrains}
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
                onchange={updateSelectFilteredStrains}
            >
                {#each getChromosomeList() as chromosome}
                    <option value={chromosome}>{chromosome}</option>
                {/each}
            </select>
        </div>

        <div class="control-group">
            <label for="readcount">Read Count Min Threshold:</label>
            <input
                type="range"
                id="readcount"
                min="0"
                max="100"
                step="1"
                bind:value={settings.readCountThresh}
                oninput={updateFilteredStrains}
            />
            <span>IncCount1&ge;{settings.readCountThresh} + IncCount2&ge;{settings.readCountThresh} + SkipCount1&ge;{settings.readCountThresh} + SkipCount2&ge;{settings.readCountThresh}</span>
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
                oninput={updateFilteredStrains}
            />
            <span>FDR&le;{settings.FDRThresh}</span>
        </div>

        <div class="control-group">
            <label for="incLevelThreshold">Inc Level Difference &verbar;ΔΨ&verbar; Threshold:</label>
            <input
                type="range"
                id="incLevelThreshold"
                min="0"
                max="1"
                step="0.01"
                bind:value={settings.psiDiffThresh}
                oninput={updateFilteredStrains}
            />
            <span>|ΔΨ|&ge;{settings.psiDiffThresh}</span>
        </div>

        <div class="control-group">
            <label for="limit">Limit PSI values to within 0.05-0.95:</label>
            <input
                type="checkbox"
                id="limit"
                bind:checked={settings.extraneousPsiLimits}
                onchange={updateSelectFilteredStrains}
            />
        </div>

        <button
            onclick={resetSettings}
        >
            Reset Settings
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
        position: relative;
        margin-bottom: 10px;
    }

    .search-results {
        position: absolute;
        top: 100%;
        left: 0;
        max-height: 200px;
        overflow-y: auto;
        background-color: var(--background-colour);
        z-index: 10;
    }

    .result-item {
        padding: 5px 10px;
        cursor: pointer;
        transition: background-color 0.2s;
    }

    .result-item:nth-child(odd) {
        background-color: var(--background-colour-secondary);
    }

    .result-item:hover {
        background-color: var(--background-colour-tertiary);
    }

    .error {
        margin-top: 6px;
        color: #db4437;
        font-size: 12px;
    }

    .info {
        margin-top: 6px;
        color: var(--text-color);
        font-size: 12px;
        opacity: 0.85;
    }
</style>