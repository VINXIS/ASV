<script lang="ts">
    import { getPositionsFromData, getSplicingExons } from "./eventHelpers";
    import { rootObserver } from "./rootObserver";
    import { type SEEvent, type MXEEvent, type ASSEvent, type RIEvent, setSelectedEvent, updatedSelectedEvent, getSelectedEvent } from "./state.svelte";

    let canvas: HTMLCanvasElement | null = $state(null);
    let ctx: CanvasRenderingContext2D | null = $state(null);

    function arrayToString(arr?: number[]): string {
        if (!arr) return "N/A";
        return arr.length > 0 ? arr.join(",") : "N/A";
    }

    function draw() {
        const selectedEvent = getSelectedEvent();
        if (!canvas || !selectedEvent) return;
        ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Reset canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Check if root has light or dark mode
        let root = document.querySelector(":root")!;
        const textColour = root.classList.contains("dark") ? "#fbfbfe" : "#1e1e1e";

        const [x, y, width, height] = [50, 100, canvas.width - 100, 100];

        const exons = getSplicingExons(selectedEvent.event);
        if (!exons.length) return;
        
        // Get position range for scaling
        const positions = getPositionsFromData(selectedEvent.event);
        const minPos = positions.start;
        const maxPos = positions.end;
        const posRange = maxPos - minPos;
        
        // Define visual properties
        const exonHeight = height * 0.4;
        const junctionHeight = height * 0.2;
        const yInclusionPath = y + height * 0.2;
        const yExclusionPath = y + height * 0.8;
        
        // Function to scale genomic position to canvas x coordinate
        const scaleX = (pos: number) => ((pos - minPos) / posRange) * width + x;
        
        // Draw inclusion path exons (solid)
        ctx.fillStyle = '#4285F4';  // Blue for inclusion path
        exons.filter(e => e.inclusion && e.type !== "junction").forEach(exon => {
            const exonX = scaleX(exon.start);
            const exonWidth = scaleX(exon.end) - exonX;
            ctx!.fillRect(exonX, yInclusionPath - exonHeight/2, exonWidth, exonHeight);
        });
        
        // Draw exclusion path exons (solid)
        ctx.fillStyle = '#DB4437';  // Red for exclusion path
        exons.filter(e => !e.inclusion && e.type !== "junction").forEach(exon => {
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
        ctx.fillText(selectedEvent.event.eventType, x + width/2, y - 5);
        
        // Draw strand indicator
        const strandSymbol = selectedEvent.event.strand === '+' ? '→' : '←';
        ctx.fillText(`${strandSymbol} ${selectedEvent.event.strand} strand`, x + width/2, y + height + 15);
        
        // Optional: Add appropriate labels depending on splicing type
        ctx.fillStyle = '#4285F4';
        ctx.fillText(`Inclusion ${selectedEvent.event.psi1Avg.toFixed(3)}`, x + width - 30, yInclusionPath - exonHeight/2 - 5);
        ctx.fillStyle = '#DB4437';
        ctx.fillText(`Exclusion ${(1-selectedEvent.event.psi1Avg).toFixed(3)}`, x + width - 30, yExclusionPath - exonHeight/2 - 5);
    }

    $effect(() => draw());
    rootObserver(draw);
    updatedSelectedEvent.addEventListener("update", draw);
</script>

{#if getSelectedEvent()}
    {@const selectedEvent = getSelectedEvent()!}
    <div id="splicing-detail-panel">
        <button
            class="close-button"
            aria-label="Close"
            onclick={() => setSelectedEvent(null)}
        >X</button>
        <h3>{selectedEvent.event.geneName || selectedEvent.event.geneID} - {selectedEvent.event.eventType}</h3>
        <canvas
            id="splicing-canvas"
            width="700"
            height="300"
            bind:this={canvas}
            style="display: block; margin: 0 auto;"
        ></canvas>
        <div class="info-divs">
            <div class="info-div">
                <p><strong>Chromosome:</strong> {selectedEvent.event.chr} ({selectedEvent.event.strand} strand)</p>
                <p><strong>FDR:</strong> {selectedEvent.event.FDR ? selectedEvent.event.FDR.toExponential(3) : 'N/A'}</p>
                <p><strong>Inclusion Level Difference (ΔΨ):</strong> {selectedEvent.event.psiDiff.toExponential(3)}</p>
                {#if selectedEvent.event.eventType === 'SE'}
                    {@const seEvent = selectedEvent.event as SEEvent}
                    <p><strong>Target Exon:</strong> {seEvent.exonStart}-{seEvent.exonEnd}</p>
                    <p><strong>Upstream Exon:</strong> {seEvent.upstreamExonStart}-{seEvent.upstreamExonEnd}</p>
                    <p><strong>Downstream Exon:</strong> {seEvent.downstreamExonStart}-{seEvent.downstreamExonEnd}</p>
                    <p><strong>Target Read Count:</strong> {arrayToString(seEvent.targetCount)}</p>
                    <p><strong>Upstream to Target Count:</strong> {arrayToString(seEvent.upstreamToTargetCount)}</p>
                    <p><strong>Target to Downstream Count:</strong> {arrayToString(seEvent.targetToDownstreamCount)}</p>
                    <p><strong>Upstream to Downstream Count:</strong> {arrayToString(seEvent.upstreamToDownstreamCount)}</p>
                {:else if selectedEvent.event.eventType === 'MXE'}
                    {@const mxeEvent = selectedEvent.event as MXEEvent}
                    <p><strong>First Exon:</strong> {mxeEvent.exon1Start}-{mxeEvent.exon1End}</p>
                    <p><strong>Second Exon:</strong> {mxeEvent.exon2Start}-{mxeEvent.exon2End}</p>
                    <p><strong>Upstream Exon:</strong> {mxeEvent.upstreamExonStart}-{mxeEvent.upstreamExonEnd}</p>
                    <p><strong>Downstream Exon:</strong> {mxeEvent.downstreamExonStart}-{mxeEvent.downstreamExonEnd}</p>
                    <p><strong>First Read Count:</strong> {arrayToString(mxeEvent.firstCount)}</p>
                    <p><strong>Second Read Count:</strong> {arrayToString(mxeEvent.secondCount)}</p>
                    <p><strong>Upstream to First Count:</strong> {arrayToString(mxeEvent.upstreamToFirstCount)}</p>
                    <p><strong>Upstream to Second Count:</strong> {arrayToString(mxeEvent.upstreamToSecondCount)}</p>
                    <p><strong>First to Downstream Count:</strong> {arrayToString(mxeEvent.firstToDownstreamCount)}</p>
                    <p><strong>Second to Downstream Count:</strong> {arrayToString(mxeEvent.secondToDownstreamCount)}</p>
                {:else if selectedEvent.event.eventType === 'A3SS' || selectedEvent.event.eventType === 'A5SS'}
                    {@const assEvent = selectedEvent.event as ASSEvent}
                    <p><strong>Long Exon:</strong> {assEvent.longExonStart}-{assEvent.longExonEnd}</p>
                    <p><strong>Short Exon:</strong> {assEvent.shortExonStart}-{assEvent.shortExonEnd}</p>
                    <p><strong>Flanking Exon:</strong> {assEvent.flankingExonStart}-{assEvent.flankingExonEnd}</p>
                    <p><strong>Across Short Boundary Count:</strong> {arrayToString(assEvent.acrossShortBoundaryCount)}</p>
                    <p><strong>Long to Flanking Count:</strong> {arrayToString(assEvent.longToFlankingCount)}</p>
                    <p><strong>Exclusive to Long Count:</strong> {arrayToString(assEvent.exclusiveToLongCount)}</p>
                    <p><strong>Short to Flanking Count:</strong> {arrayToString(assEvent.shortToFlankingCount)}</p>
                {:else if selectedEvent.event.eventType === 'RI'}
                    {@const riEvent = selectedEvent.event as RIEvent}
                    <p><strong>RI Exon:</strong> {riEvent.riExonStart}-{riEvent.riExonEnd}</p>
                    <p><strong>Upstream Exon:</strong> {riEvent.upstreamExonStart}-{riEvent.upstreamExonEnd}</p>
                    <p><strong>Downstream Exon:</strong> {riEvent.downstreamExonStart}-{riEvent.downstreamExonEnd}</p>
                    <p><strong>Intron Count:</strong> {arrayToString(riEvent.intronCount)}</p>
                    <p><strong>Upstream to Intron Count:</strong> {arrayToString(riEvent.upstreamToIntronCount)}</p>
                    <p><strong>Intron to Downstream Count:</strong> {arrayToString(riEvent.intronToDownstreamCount)}</p>
                    <p><strong>Upstream to Downstream Count:</strong> {arrayToString(riEvent.upstreamToDownstreamCount)}</p>
                {/if}
            </div>
            {#if selectedEvent.geneEvents.length > 0}
                <div class="info-div">
                    <h4>All events for this Gene:</h4>
                    <ul>
                        {#each selectedEvent.geneEvents as event}
                            {@const positions = getPositionsFromData(event.event)}
                            <li style="color: {event.strain.colour}">
                                ({event.strain.name}):
                                <ul>
                                    <li>Event Type: {event.event.eventType}</li>
                                    <li>FDR: {event.event.FDR ? event.event.FDR.toExponential(3) : 'N/A'}</li>
                                    <li>Inclusion Level Difference (ΔΨ): {event.event.psiDiff.toExponential(3)}</li>
                                    <li>Location: {event.event.chr} ({event.event.strand} strand) {positions.start}-{positions.end}</li>
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
        z-index: 1000;
        border-radius: 5px;
        max-width: 800px;
        width: 80%;
    }

    .close-button {
        position: absolute;
        top: 10px;
        right: 10px;
        border: none;
        background: none;
        font-size: 20px;
        cursor: pointer;
    }

    .info-divs {
        display: flex;
        justify-content: space-between;
    }
</style>