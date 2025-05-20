<script lang="ts">
    import { getPositionsFromData, getSplicingExons } from "./eventHelpers";
    import { rootObserver } from "./rootObserver";
    import { type SEEvent, type MXEEvent, type ASSEvent, type RIEvent, eventColours, type Event } from "./states/strains";
    import PieChart from "./charts/pie.svelte";
    import ViolinChart from "./charts/violin.svelte";
    import VolcanoChart from "./charts/volcano.svelte";
    import { getSelectedEvent, setSelectedEvent, updatedSelectedEvent, type SelectedEvent } from "./states/selectedEvent";
    import { settings } from "./states/settings";
    import { getFeaturesByGene, type Feature } from "./states/gtf";

    let canvas: HTMLCanvasElement | null = null;
    let selectedEvent: SelectedEvent | null = null;
    let blueTranscript: string | null = null;
    let redTranscript: string | null = null;
    let useFilter = true;
    let readCountThresh = true;
    let filteredEvents: {
        strain: {
            name: string;
            colour: string;
        };
        event: Event;
    }[] = [];
    let eventCounts: Record<string, number> = {};

    function arrayToString(arr?: number[]): string {
        if (!arr) return "N/A";
        return arr.length > 0 ? arr.join(",") : "N/A";
    }

    function updateValues() {
        selectedEvent = getSelectedEvent();
        if (!selectedEvent)
            return;
        filteredEvents = selectedEvent.geneEvents.filter(event => {
            const readCountCheck = event.event.incCount1Avg >= settings.readCountThresh;
            if (readCountThresh && !readCountCheck)
                return false;
            if (!useFilter) return true;

            const chromosomeCheck = settings.selectedChr === "All" || (event.event.chr && event.event.chr.startsWith(settings.selectedChr));
            const limitCheck = settings.extraneousPsiLimits === false || event.event.psi1Avg >= 0.05 && event.event.psi1Avg <= 0.95;
            const FDRCheck = event.event.FDR <= settings.FDRThresh;
            const psiDiffCheck = Math.abs(event.event.psiDiff) >= settings.psiDiffThresh;
            return chromosomeCheck && limitCheck && FDRCheck && psiDiffCheck;
        }) || [];
        eventCounts = filteredEvents.reduce((acc, event) => {
            const eventType = event.event.eventType;
            acc[eventType] = (acc[eventType] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        draw();
    }

    function draw() {
        const selectedEvent = getSelectedEvent();
        if (!canvas || !selectedEvent) {
            requestAnimationFrame(draw);
            return;
        }
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Reset canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Check if root has light or dark mode
        let root = document.querySelector(":root")!;
        const textColour = root.classList.contains("dark") ? "#fbfbfe" : "#1e1e1e";

        const [x, y, width, height] = [50, 100, canvas.width - 100, 150];

        const exons = getSplicingExons(selectedEvent.event);
        if (!exons.length) return;

        // Currently "gene_number" is corresponding to each transcript, it should instead correspond to their location instead
        const geneFeatures = getFeaturesByGene(selectedEvent.event.geneName || selectedEvent.event.geneID).filter(g => g.feature === "exon");
        // Get unique genes from start/end positions
        let uniqueGenes = geneFeatures.filter((g, index, self) => index === self.findIndex(t => t.start === g.start || t.end === g.end));
        uniqueGenes.sort((a, b) => a.start - b.start);
        uniqueGenes = uniqueGenes.map((g, index) => ({
            ...g,
            attributes: {
                ...g.attributes,
                exon_number: g.strand === '+' ? index + 1 : uniqueGenes.length - index // Assign exon number based on strand direction
            }
        }));
        const transcriptGroups = uniqueGenes.reduce((acc, feature) => {
            const transcriptId = feature.attributes["transcript_id"];
            if (!acc[transcriptId])
                acc[transcriptId] = [];
            acc[transcriptId].push(feature);
            return acc;
        }, {} as Record<string, Feature[]>);

        // See which transcript the selected event belongs to
        for (const transcriptId in transcriptGroups) {
            if (exons.filter(exon => exon.inclusion && exon.type !== "intron" && exon.type !== "junction").every(exon => transcriptGroups[transcriptId].some(g => Math.abs(g.start - exon.start) < 2 || Math.abs(g.end - exon.end) < 2))) {
                blueTranscript = transcriptId;
                break;
            }
            if (exons.filter(exon => !exon.inclusion && exon.type !== "intron" && exon.type !== "junction").every(exon => transcriptGroups[transcriptId].some(g => Math.abs(g.start - exon.start) < 2 || Math.abs(g.end - exon.end) < 2))) {
                redTranscript = transcriptId;
                break;
            } 
        }
        
        // Get position range for scaling
        const positions = getPositionsFromData(selectedEvent.event);
        const minPos = Math.min(positions.start);
        const maxPos = Math.max(positions.end);
        const posRange = maxPos - minPos;
        
        // Define visual properties
        const exonHeight = height * 0.3;
        const junctionHeight = height * 0.15;
        const yGTFPath = y + height * 0.1;
        const yInclusionPath = y + height * 0.5;
        const yExclusionPath = y + height * 0.9;
        
        // Function to scale genomic position to canvas x coordinate
        const scaleX = (pos: number) => ((pos - minPos) / posRange) * width + x;

        // Draw Exons for GTF Path
        uniqueGenes.forEach(feature => {
            if (feature.start < minPos || feature.end > maxPos) return; // Skip if outside range

            const exonX = scaleX(feature.start);
            const exonWidth = scaleX(feature.end) - exonX;

            ctx.fillStyle = '#34A853';  // Green for GTF path
            ctx.fillRect(exonX, yGTFPath - exonHeight/2, exonWidth, exonHeight);
            // Write the exon number on top
            ctx.fillStyle = textColour;
            ctx.font = '10px Inconsolata';
            ctx.textAlign = 'center';
            ctx.fillText(`E${feature.attributes["exon_number"]}`, exonX + exonWidth / 2, yGTFPath - exonHeight/2 - 5);
        });
        
        // Draw inclusion path exons (solid)
        ctx.fillStyle = '#4285F4';  // Blue for inclusion path
        exons.filter(e => e.inclusion && e.type !== "junction").forEach(exon => {
            const exonX = scaleX(exon.start);
            const exonWidth = scaleX(exon.end) - exonX;
            ctx!.fillRect(exonX, yInclusionPath - exonHeight/2, exonWidth, exonHeight);
        });
        
        // Draw exclusion path exons (solid)
        ctx.fillStyle = '#DB4437';  // Red for exclusion path
        exons.filter(e => (!e.inclusion || e.type === "upstream" || e.type === "downstream" || e.type === "flanking") && e.type !== "junction").forEach(exon => {
            const exonX = scaleX(exon.start);
            const exonWidth = scaleX(exon.end) - exonX;
            ctx!.fillRect(exonX, yExclusionPath - exonHeight/2, exonWidth, exonHeight);
        });
        
        // Draw inclusion junctions (dashed)
        ctx.strokeStyle = '#4285F4';
        ctx.setLineDash([5, 3]);
        ctx.lineWidth = 2;
        exons.filter(e => e.inclusion && e.type === "junction").forEach(junction => {
            const startX = scaleX(junction.start);
            const endX = scaleX(junction.end);
            
            ctx!.beginPath();
            ctx!.moveTo(startX, yInclusionPath);
            
            // Draw curved junction line
            const controlX = (startX + endX) / 2;
            const controlY = yInclusionPath - junctionHeight;
            ctx!.quadraticCurveTo(controlX, controlY, endX, yInclusionPath);
            ctx!.stroke();
        });
        
        // Draw exclusion junctions (dashed)
        ctx.strokeStyle = '#DB4437';
        exons.filter(e => !e.inclusion && e.type === "junction").forEach(junction => {
            const startX = scaleX(junction.start);
            const endX = scaleX(junction.end);
            
            ctx!.beginPath();
            ctx!.moveTo(startX, yExclusionPath);
            
            // Draw curved junction line
            const controlX = (startX + endX) / 2;
            const controlY = yExclusionPath - junctionHeight;
            ctx!.quadraticCurveTo(controlX, controlY, endX, yExclusionPath);
            ctx!.stroke();
        });
        
        // Reset dash pattern
        ctx.setLineDash([]);
        
        // Add labels if desired
        ctx.fillStyle = textColour;
        ctx.font = '10px Inconsolata';
        ctx.textAlign = 'center';
        
        // Draw splicing type label
        ctx.fillText(selectedEvent.event.eventType, x + width/2, y - 50);
        
        // Draw strand indicator
        const strandSymbol = selectedEvent.event.strand === '+' ? '→' : '←';
        ctx.fillText(`${strandSymbol} ${selectedEvent.event.strand} strand`, x + width/2, y + height + 15);
        
        // Optional: Add appropriate labels depending on splicing type
        ctx.fillStyle = '#4285F4';
        ctx.fillText(`Ψ1: ${selectedEvent.event.psi1Avg.toFixed(3)}; Ψ2: ${selectedEvent.event.psi2Avg.toFixed(3)}`, x + width - 30, yInclusionPath - exonHeight/2 - 5);
        ctx.fillStyle = '#DB4437';
        ctx.fillText(`1 - Ψ1: ${(1-selectedEvent.event.psi1Avg).toFixed(3)}; 1 - Ψ2: ${(1-selectedEvent.event.psi2Avg).toFixed(3)}`, x + width - 30, yExclusionPath - exonHeight/2 - 5);
        ctx.fillStyle = '#34A853';
        ctx.fillText("GTF", scaleX(maxPos) + ctx.measureText("GTF").width, yGTFPath);
    }

    function changeFilter(value: boolean) {
        useFilter = value;
        updateValues();
    }

    function changeReadCountThresh(value: boolean) {
        readCountThresh = value;
        updateValues();
    }

    rootObserver(draw);
    updatedSelectedEvent.addEventListener("update", updateValues);
</script>

{#if selectedEvent}
    {@const selectedPositions = getPositionsFromData(selectedEvent.event)}
    <div id="splicing-detail-panel">
        <button
            class="close-button"
            aria-label="Close"
            onclick={() => setSelectedEvent(null)}
        >X</button>
        <h3 style="color: {selectedEvent.strain.colour}">{selectedEvent.event.geneName || selectedEvent.event.geneID} - {selectedEvent.event.eventType}</h3>
        <canvas
            id="splicing-canvas"
            width="700"
            height="300"
            bind:this={canvas}
            style="display: block; margin: 0 auto;"
        ></canvas>
        <div class="info-divs">
            <div class="info-div">
                (~2bp leniency checks)
                <p style="color: #4285F4">
                    <strong>Ver 1 Transcript:</strong>
                    {#if blueTranscript}
                        <a href="http://www.ncbi.nlm.nih.gov/nuccore/{blueTranscript}" target="_blank" rel="noopener noreferrer">
                            {blueTranscript}
                        </a>
                    {:else}
                        N/A
                    {/if}
                </p>
                <p style="color: #DB4437">
                    <strong>Ver 2 Transcript:</strong>
                    {#if redTranscript}
                        <a href="http://www.ncbi.nlm.nih.gov/nuccore/{redTranscript}" target="_blank" rel="noopener noreferrer">
                            {redTranscript}
                        </a>
                    {:else}
                        N/A
                    {/if}
                <p><strong>Chromosome:</strong> {selectedEvent.event.chr} ({selectedEvent.event.strand} strand)</p>
                <p><strong>FDR:</strong> {Math.abs(selectedEvent.event.FDR) < 0.001 ? selectedEvent.event.FDR.toExponential(3) : selectedEvent.event.FDR.toFixed(3)}</p>
                <p><strong>Inclusion Level Difference (ΔΨ):</strong> {Math.abs(selectedEvent.event.psiDiff) < 0.001 ? selectedEvent.event.psiDiff.toExponential(3) : selectedEvent.event.psiDiff.toFixed(3)}</p>
                <p><strong>Total Position:</strong> {selectedPositions.start} - {selectedPositions.end}</p>
                <p><strong>Inclusion Level 1 Avg.:</strong> {Math.abs(selectedEvent.event.psi1Avg) < 0.001 ? selectedEvent.event.psi1Avg.toExponential(3) : selectedEvent.event.psi1Avg.toFixed(3)}</p>
                <p><strong>Inclusion Level 2 Avg.:</strong> {Math.abs(selectedEvent.event.psi2Avg) < 0.001 ? selectedEvent.event.psi2Avg.toExponential(3) : selectedEvent.event.psi2Avg.toFixed(3)}</p>
                <p><strong>Read Count 1 Avg.:</strong> {selectedEvent.event.incCount1Avg.toFixed(3)}</p>
                <p><strong>Read Count 2 Avg.:</strong> {selectedEvent.event.incCount2Avg.toFixed(3)}</p>
                {#if selectedEvent.event.eventType === 'SE'}
                    {@const seEvent = selectedEvent.event as SEEvent}
                    <p><strong>Target Exon:</strong> {seEvent.exonStart} - {seEvent.exonEnd}</p>
                    <p><strong>Upstream Exon:</strong> {seEvent.upstreamExonStart} - {seEvent.upstreamExonEnd}</p>
                    <p><strong>Downstream Exon:</strong> {seEvent.downstreamExonStart} - {seEvent.downstreamExonEnd}</p>
                    <p><strong>Target Read Count:</strong> {arrayToString(seEvent.targetCount)}</p>
                    <p><strong>Upstream to Target Count:</strong> {arrayToString(seEvent.upstreamToTargetCount)}</p>
                    <p><strong>Target to Downstream Count:</strong> {arrayToString(seEvent.targetToDownstreamCount)}</p>
                    <p><strong>Upstream to Downstream Count:</strong> {arrayToString(seEvent.upstreamToDownstreamCount)}</p>
                {:else if selectedEvent.event.eventType === 'MXE'}
                    {@const mxeEvent = selectedEvent.event as MXEEvent}
                    <p><strong>First Exon:</strong> {mxeEvent.exon1Start} - {mxeEvent.exon1End}</p>
                    <p><strong>Second Exon:</strong> {mxeEvent.exon2Start} - {mxeEvent.exon2End}</p>
                    <p><strong>Upstream Exon:</strong> {mxeEvent.upstreamExonStart} - {mxeEvent.upstreamExonEnd}</p>
                    <p><strong>Downstream Exon:</strong> {mxeEvent.downstreamExonStart} - {mxeEvent.downstreamExonEnd}</p>
                    <p><strong>First Read Count:</strong> {arrayToString(mxeEvent.firstCount)}</p>
                    <p><strong>Second Read Count:</strong> {arrayToString(mxeEvent.secondCount)}</p>
                    <p><strong>Upstream to First Count:</strong> {arrayToString(mxeEvent.upstreamToFirstCount)}</p>
                    <p><strong>Upstream to Second Count:</strong> {arrayToString(mxeEvent.upstreamToSecondCount)}</p>
                    <p><strong>First to Downstream Count:</strong> {arrayToString(mxeEvent.firstToDownstreamCount)}</p>
                    <p><strong>Second to Downstream Count:</strong> {arrayToString(mxeEvent.secondToDownstreamCount)}</p>
                {:else if selectedEvent.event.eventType === 'A3SS' || selectedEvent.event.eventType === 'A5SS'}
                    {@const assEvent = selectedEvent.event as ASSEvent}
                    <p><strong>Long Exon:</strong> {assEvent.longExonStart} - {assEvent.longExonEnd}</p>
                    <p><strong>Short Exon:</strong> {assEvent.shortExonStart} - {assEvent.shortExonEnd}</p>
                    <p><strong>Flanking Exon:</strong> {assEvent.flankingExonStart} - {assEvent.flankingExonEnd}</p>
                    <p><strong>Across Short Boundary Count:</strong> {arrayToString(assEvent.acrossShortBoundaryCount)}</p>
                    <p><strong>Long to Flanking Count:</strong> {arrayToString(assEvent.longToFlankingCount)}</p>
                    <p><strong>Exclusive to Long Count:</strong> {arrayToString(assEvent.exclusiveToLongCount)}</p>
                    <p><strong>Short to Flanking Count:</strong> {arrayToString(assEvent.shortToFlankingCount)}</p>
                {:else if selectedEvent.event.eventType === 'RI'}
                    {@const riEvent = selectedEvent.event as RIEvent}
                    <p><strong>RI Exon:</strong> {riEvent.riExonStart} - {riEvent.riExonEnd}</p>
                    <p><strong>Upstream Exon:</strong> {riEvent.upstreamExonStart} - {riEvent.upstreamExonEnd}</p>
                    <p><strong>Downstream Exon:</strong> {riEvent.downstreamExonStart} - {riEvent.downstreamExonEnd}</p>
                    <p><strong>Intron Count:</strong> {arrayToString(riEvent.intronCount)}</p>
                    <p><strong>Upstream to Intron Count:</strong> {arrayToString(riEvent.upstreamToIntronCount)}</p>
                    <p><strong>Intron to Downstream Count:</strong> {arrayToString(riEvent.intronToDownstreamCount)}</p>
                    <p><strong>Upstream to Downstream Count:</strong> {arrayToString(riEvent.upstreamToDownstreamCount)}</p>
                {/if}
                <ViolinChart
                    keys={["Ψ1", "Ψ2"]}
                    data={[filteredEvents.flatMap(event => event.event.psi1), filteredEvents.flatMap(event => event.event.psi2)]}
                    updateOnFilter="selectedEvent"
                ></ViolinChart>
                <PieChart
                    data={eventCounts}
                ></PieChart>
                <VolcanoChart
                    data={[selectedEvent.event, ...selectedEvent.geneEvents.map(e => e.event)]}
                    strain={{ name: selectedEvent.event.geneName, colour: selectedEvent.strain.colour }}
                    updateOnFilter="selectedEvent"
                ></VolcanoChart>
            </div>
            {#if selectedEvent.geneEvents.length > 0}
                <div class="info-div">
                    <h4>All events for this Gene ({filteredEvents.length} events)</h4>
                    <button
                        class="toggle-filter"
                        style="margin-bottom: 10px;"
                        onclick={() => changeFilter(!useFilter)}
                    >
                        {useFilter ? "Show All Events" : "Show Filtered Events (excl. Event Type)"}
                    </button>
                    <button
                        class="toggle-filter"
                        onclick={() => changeReadCountThresh(!readCountThresh)}
                    >
                        {readCountThresh ? "Show All Read Counts" : "Enforce Read Count Threshold"}
                    </button>
                    <ul>
                        {#each filteredEvents as event}
                            {@const positions = getPositionsFromData(event.event)}
                            <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                            <li
                                style="color: {event.strain.colour}; cursor: pointer;"
                                onclick={() => {
                                    setSelectedEvent(event);
                                    draw();
                                }}
                                onkeydown={() => {
                                    setSelectedEvent(event);
                                    draw();
                                }}
                            >
                                {#if selectedEvent.strain.name === event.strain.name && selectedPositions.start === positions.start && selectedPositions.end === positions.end && selectedEvent.event.eventType === event.event.eventType && selectedEvent.event.strand === event.event.strand && selectedEvent.event.psiDiff === event.event.psiDiff && selectedEvent.event.FDR === event.event.FDR}
                                    <strong>{event.strain.name} (Selected)</strong>
                                {:else}
                                    {event.strain.name}
                                {/if}
                                <ul>
                                    
                                    <li style="color: {eventColours[event.event.eventType]}">Event Type: {event.event.eventType}</li>
                                    <li>FDR: {Math.abs(event.event.FDR) < 0.001 && event.event.FDR !== 0 ? event.event.FDR.toExponential(3) : event.event.FDR.toFixed(3)}</li>
                                    <li>Inclusion Level Difference (ΔΨ): {Math.abs(event.event.psiDiff) < 0.001 ? event.event.psiDiff.toExponential(3) : event.event.psiDiff.toFixed(3)}</li>
                                    <li>Read Count 1 Avg.: {event.event.incCount1Avg.toFixed(3)}</li>
                                    <li>Location: {event.event.chr} ({event.event.strand} strand) {positions.start} - {positions.end}</li>
                                </ul>
                            </li>
                        {/each}
                    </ul>
                </div>
            {/if}
        </div>
    </div>
{/if}

<style>
    #splicing-detail-panel {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: var(--background-colour);
        padding: 20px;
        box-shadow: 0 0 10px rgba(0,0,0,0.5);
        z-index: 100;
        border-radius: 5px;
        max-width: 800px;
        width: 80%;
        height: 80%;
        overflow: auto;
    }

    .close-button {
        position: sticky;
        top: 0;
        left: 100%;
        border: none;
        background: none;
        font-size: 20px;
        cursor: pointer;
    }

    .info-divs {
        display: flex;
        justify-content: space-between;
    }

    .info-div {
        flex: 1;
    }
</style>