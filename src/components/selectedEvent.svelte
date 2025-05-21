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
    let inclusionTranscript: string | null = null;
    let skippedTranscript: string | null = null;
    let useFilter = true;
    let readCountThresh = true;
    let mouseData: { x: number; y: number } | null = null;
    let filteredEvents: {
        strain: {
            name: string;
            colour: string;
        };
        event: Event;
    }[] = [];
    let eventCounts: Record<string, number> = {};

    // Zoom variables
    let zoomLevel = 1;
    let xOffset = 0;
    let drag = false;
    let lastMouseX = 0;

    const colours = {
        inclusion: "#4285F4",
        skipped: "#DB4437",
        gtf: "#888888",
    }

    function arrayToString(arr?: number[]): string {
        if (!arr) return "N/A";
        return arr.length > 0 ? arr.join(",") : "N/A";
    }

    function updateValues(mustDraw = true) {
        selectedEvent = getSelectedEvent();
        if (!selectedEvent)
            return;
        filteredEvents = selectedEvent.geneEvents.filter(event => {
            const readCountCheck = event.event.incCount1Avg >= settings.readCountThresh && event.event.incCount2Avg >= settings.readCountThresh && event.event.skipCount1Avg >= settings.readCountThresh && event.event.skipCount2Avg >= settings.readCountThresh;
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
        if (mustDraw)
            draw();
    }

    function drawHoverInfo(startX: number, endX: number, yStart: number, yEnd: number, colour: string, value: string) {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.strokeStyle = colour;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(startX, yStart);
        ctx.lineTo(startX, yEnd);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(endX, yStart);
        ctx.lineTo(endX, yEnd);
        ctx.stroke();

        ctx.font = '10px Inconsolata';
        ctx.textAlign = 'center';
        ctx.fillStyle = colour;
        ctx.fillText(value, startX + (endX - startX) / 2, yStart - 20);
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
        ctx.setLineDash([5, 3]);

        // Check if root has light or dark mode
        let root = document.querySelector(":root")!;
        const textColour = root.classList.contains("dark") ? "#fbfbfe" : "#1e1e1e";

        const [x, y, width, height] = [25, 100, canvas.width - 100, 150];

        const exons = getSplicingExons(selectedEvent.event);
        if (!exons.length) return;

        // Currently "gene_number" is corresponding to each transcript, it should instead correspond to their location instead
        const geneFeatures = getFeaturesByGene(selectedEvent.event.geneName || selectedEvent.event.geneID).filter(g => g.feature === "exon");
        // Get unique genes from start/end positions
        let uniqueGenes = geneFeatures.filter((g, index, self) => index === self.findIndex(t => Math.abs(t.start - g.start) < 3 && Math.abs(t.end - g.end) < 3));
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
        inclusionTranscript = null;
        skippedTranscript = null;
        for (const transcriptId in transcriptGroups) {
            if (exons.filter(exon => exon.inclusion && exon.type !== "intron" && exon.type !== "junction").every(exon => transcriptGroups[transcriptId].some(g => Math.abs(g.start - exon.start) < 3 && Math.abs(g.end - exon.end) < 3)))
                inclusionTranscript = transcriptId;
            if (exons.filter(exon => !exon.inclusion && exon.type !== "intron" && exon.type !== "junction").every(exon => transcriptGroups[transcriptId].some(g => Math.abs(g.start - exon.start) < 3 && Math.abs(g.end - exon.end) < 3)))
                skippedTranscript = transcriptId;
            if (inclusionTranscript && skippedTranscript)
                break;
        }
        
        // Get position range for scaling
        const positions = getPositionsFromData(selectedEvent.event);
        const absoluteStart = Math.min(positions.start, ...uniqueGenes.map(g => g.start));
        const absoluteEnd = Math.max(positions.end, ...uniqueGenes.map(g => g.end));
        const totalRange = absoluteEnd - absoluteStart;
        
        // Apply zoom and offset
        const visibleRange = totalRange / zoomLevel;
        const adjustedMin = absoluteStart + xOffset * totalRange;
        const adjustedMax = Math.min(absoluteEnd, adjustedMin + visibleRange);
        const posRange = adjustedMax - adjustedMin;
        
        // Define visual properties
        const exonHeight = height * 0.3;
        const yGTFPath = y + height * 0.1;
        const yInclusionPath = y + height * 0.5;
        const ySkippedPath = y + height * 0.9;
        
        // Function to scale genomic position to canvas x coordinate
        const scaleX = (pos: number) => ((pos - adjustedMin) / posRange) * width + x
        
        // Draw inclusion path exons (solid)
        ctx.fillStyle = colours.inclusion;
        exons.filter(e => e.inclusion && e.type !== "junction").forEach(exon => {
            // Only draw if within visible range
            if (exon.end < adjustedMin || exon.start > adjustedMax) return;

            const exonX = Math.max(scaleX(exon.start), x);
            const exonWidth = Math.min(scaleX(exon.end), x + width) - exonX;
            ctx!.fillRect(exonX, yInclusionPath - exonHeight/2, exonWidth, exonHeight);

            if (mouseData &&
                mouseData.x >= exonX &&
                mouseData.x <= exonX + exonWidth &&
                mouseData.y >= yInclusionPath - exonHeight/2 &&
                mouseData.y <= yInclusionPath + exonHeight/2
            ) {
                drawHoverInfo(exonX, exonX + exonWidth, yGTFPath - exonHeight/2, ySkippedPath + exonHeight/2, colours.inclusion, `${exon.end - exon.start} nt`);
            }
        });
        
        // Draw skipped path exons (solid)
        ctx.fillStyle = colours.skipped;  // Red for skipped path
        exons.filter(e => (!e.inclusion || e.type === "upstream" || e.type === "downstream" || e.type === "flanking") && e.type !== "junction").forEach(exon => {
            // Only draw if within visible range
            if (exon.end < adjustedMin || exon.start > adjustedMax) return;

            const exonX = Math.max(scaleX(exon.start), x);
            const exonWidth = Math.min(scaleX(exon.end), x + width) - exonX;
            ctx!.fillRect(exonX, ySkippedPath - exonHeight/2, exonWidth, exonHeight);

            if (mouseData &&
                mouseData.x >= exonX &&
                mouseData.x <= exonX + exonWidth &&
                mouseData.y >= ySkippedPath - exonHeight/2 &&
                mouseData.y <= ySkippedPath + exonHeight/2
            ) {
                drawHoverInfo(exonX, exonX + exonWidth, yGTFPath - exonHeight/2, ySkippedPath + exonHeight/2, colours.skipped, `${exon.end - exon.start} nt`);
            }
        });
        
        // Draw junctions (dashed)
        ctx.lineWidth = 2;
        exons.filter(e => e.type === "junction").forEach(junction => {
            // Only draw if within visible range
            if (junction.end < adjustedMin || junction.start > adjustedMax) return;

            const startX = Math.max(scaleX(junction.start), x);
            const endX = Math.min(scaleX(junction.end), x + width);
            const path = junction.inclusion ? yInclusionPath : ySkippedPath;
            const colour = junction.inclusion ? colours.inclusion : colours.skipped;

            ctx.strokeStyle = colour;
            ctx!.beginPath();
            ctx!.moveTo(startX, path);
            ctx!.lineTo(endX, path);
            ctx!.stroke();

            if (
                mouseData &&
                mouseData.x >= startX &&
                mouseData.x <= endX &&
                mouseData.y >= path - exonHeight/2 &&
                mouseData.y <= path + exonHeight/2
            ) {
                drawHoverInfo(startX, endX, yGTFPath - exonHeight/2, ySkippedPath + exonHeight/2, colour, `${junction.end - junction.start} nt`);
                ctx.lineWidth = 2;
            }
        });

        // Draw Exons for GTF Path
        uniqueGenes.forEach(feature => {
            // Only draw if within visible range
            if (feature.end < adjustedMin || feature.start > adjustedMax) return;

            const exonX = Math.max(scaleX(feature.start), x);
            const exonWidth = Math.min(scaleX(feature.end), x + width) - exonX;

            ctx.fillStyle = colours.gtf;
            ctx.fillRect(exonX, yGTFPath - exonHeight/2, exonWidth, exonHeight);

            // Write the exon number on top if there's enough space
            if (exonWidth > 15) {
                ctx.fillStyle = textColour;
                ctx.font = '10px Inconsolata';
                ctx.textAlign = 'center';
                ctx.fillText(`E${feature.attributes["exon_number"]}`, exonX + exonWidth / 2, yGTFPath - exonHeight/2 - 5);
            }

            if (
                mouseData &&
                mouseData.x >= exonX &&
                mouseData.x <= exonX + exonWidth &&
                mouseData.y >= yGTFPath - exonHeight/2 &&
                mouseData.y <= yGTFPath + exonHeight/2
            ) {
                drawHoverInfo(exonX, exonX + exonWidth, yGTFPath - exonHeight/2, ySkippedPath + exonHeight/2, colours.gtf, `${feature.end - feature.start} nt`);
            }
        });
        
        // Add labels
        ctx.fillStyle = textColour;
        ctx.font = '12px Inconsolata';
        ctx.textAlign = 'center';
        
        // Draw splicing type label
        ctx.fillText(selectedEvent.event.eventType, x + width/2, y - 50);
        
        // Draw strand indicator
        const strandSymbol = selectedEvent.event.strand === '+' ? '→' : '←';
        ctx.fillText(`${strandSymbol} ${selectedEvent.event.strand} strand`, x + width/2, y + height + 20);
        
        // Optional: Add appropriate labels depending on splicing type
        ctx.fillStyle = colours.inclusion;
        ctx.fillText(`Ψ1: ${selectedEvent.event.psi1Avg.toFixed(3)}`, width + x + 32, yInclusionPath - 7);
        ctx.fillText(`Ψ2: ${selectedEvent.event.psi2Avg.toFixed(3)}`, width + x + 32, yInclusionPath + 7);
        ctx.fillStyle = colours.skipped;
        ctx.fillText(`1-Ψ1: ${(1 - selectedEvent.event.psi1Avg).toFixed(3)}`, width + x + 38, ySkippedPath - 7);
        ctx.fillText(`1-Ψ2: ${(1 - selectedEvent.event.psi2Avg).toFixed(3)}`, width + x + 38, ySkippedPath + 7);
        ctx.fillStyle = colours.gtf;
        ctx.fillText("GTF", width + x + 16, yGTFPath);

        // X axis
        ctx.strokeStyle = textColour;
        ctx.setLineDash([]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + width, 0);
        ctx.stroke();
        
        ctx.fillStyle = textColour;
        ctx.font = "10px Inconsolata";
        ctx.textAlign = "center";

        const tickCount = 4;
        const tickInterval = posRange / tickCount;
        
        for (let i = 0; i <= tickCount; i++) {
            const position = adjustedMin + i * tickInterval;
            const xPos = (i / tickCount) * width + x;            
            ctx.beginPath();
            ctx.moveTo(xPos, 0);
            ctx.lineTo(xPos, 5);
            ctx.stroke();
            
            const label = Math.round(position - absoluteStart);
            ctx.fillText(label.toString(), xPos, 15);
        }
        
        ctx.textAlign = "left";
        ctx.font = "10px Inconsolata";
        ctx.fillText("Position (nt)", 5, 25);

        // Draw zoom indicator
        ctx.textAlign = "right";
        ctx.fillText(`Zoom: ${zoomLevel.toFixed(1)}x`, canvas.width - 10, 25);
    }

    function handleMouseMove(event: MouseEvent) {
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        if (drag) {
            // Calculate how much the mouse has moved
            const dx = lastMouseX - x;
            lastMouseX = x;
            
            // Adjust xOffset based on mouse movement and current zoom level
            if (!selectedEvent) return;
            
            // Convert pixel movement to genomic position proportion
            const moveAmount = dx / canvas.width * (1 / zoomLevel);
            xOffset = Math.max(0, Math.min(1 - (1/zoomLevel), xOffset + moveAmount));
            
            draw();
        } else {
            mouseData = { x, y };
            draw();
        }
    }

    function handleMouseDown(event: MouseEvent) {
        if (!canvas) return;
        drag = true;
        const rect = canvas.getBoundingClientRect();
        lastMouseX = event.clientX - rect.left;
        canvas.style.cursor = "grabbing";
    }

    function handleMouseUp() {
        drag = false;
        if (canvas) canvas.style.cursor = "default";
    }

    function handleMouseLeave() {
        drag = false;
        mouseData = null;
        if (canvas) canvas.style.cursor = "default";
        draw();
    }

    function handleWheel(event: WheelEvent) {
        if (!canvas || !selectedEvent) return;
        
        event.preventDefault();
        
        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseProportion = (mouseX - 25) / (canvas.width - 100);
        
        // Calculate zoom level change
        const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
        const newZoomLevel = Math.min(1000, Math.max(1, zoomLevel * zoomFactor));
        
        // Keep the mouse position fixed relative to the genomic position
        const oldVisibleProportion = 1 / zoomLevel;
        const newVisibleProportion = 1 / newZoomLevel;
        const oldOffset = xOffset;
        const offsetUnderMouse = oldOffset + mouseProportion * oldVisibleProportion;
        const newOffset = offsetUnderMouse - mouseProportion * newVisibleProportion;
        
        zoomLevel = newZoomLevel;
        xOffset = Math.max(0, Math.min(1 - (1/zoomLevel), newOffset));
        
        draw();
    }

    function resetView() {
        zoomLevel = 1;
        xOffset = 0;
        draw();
    }

    function zoomToEvent() {
        if (!selectedEvent) return;
        const positions = getPositionsFromData(selectedEvent.event);
        const geneFeatures = getFeaturesByGene(selectedEvent.event.geneName || selectedEvent.event.geneID).filter(g => g.feature === "exon");
        const uniqueGenes = geneFeatures.filter((g, index, self) => index === self.findIndex(t => Math.abs(t.start - g.start) < 3 && Math.abs(t.end - g.end) < 3));
        const absoluteStart = Math.min(positions.start, ...uniqueGenes.map(g => g.start));
        const absoluteEnd = Math.max(positions.end, ...uniqueGenes.map(g => g.end));

        const totalRange = absoluteEnd - absoluteStart;
        const eventRange = positions.end - positions.start;

        // Set zoom level to fit the event
        zoomLevel = totalRange / eventRange;
        xOffset = (positions.start - absoluteStart) / (absoluteEnd - absoluteStart);
        
        draw();
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
    updatedSelectedEvent.addEventListener("update", () => {
        updateValues(false);
        zoomToEvent();
    });
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
        <div class="canvas-controls">
            <button class="reset-view-button" onclick={resetView}>
                Full Gene Context
            </button>
            <button class="reset-view-button" onclick={zoomToEvent}>
                Zoom to Event
            </button>
            <span class="zoom-instructions">Use mouse wheel to zoom, drag to pan</span>
        </div>
        <br>
        <canvas
            id="splicing-canvas"
            width="700"
            height="300"
            bind:this={canvas}
            onmousedown={handleMouseDown}
            onmouseup={handleMouseUp}
            onmouseleave={handleMouseLeave}
            onmousemove={handleMouseMove}
            onclick={() => {}} 
            onwheel={handleWheel}
            style="display: block; margin: 0 auto;"
        ></canvas>
        <div class="info-divs">
            <div class="info-div">
                (3nt leniency checks)
                <p style="color: {colours.inclusion}">
                    <strong>Inclusion form transcript:</strong>
                    {#if inclusionTranscript}
                        <a href="http://www.ncbi.nlm.nih.gov/nuccore/{inclusionTranscript}" target="_blank" rel="noopener noreferrer">
                            {inclusionTranscript}
                        </a>
                    {:else}
                        N/A
                    {/if}
                </p>
                <p style="color: {colours.skipped}">
                    <strong>Skipped form Transcript:</strong>
                    {#if skippedTranscript}
                        <a href="http://www.ncbi.nlm.nih.gov/nuccore/{skippedTranscript}" target="_blank" rel="noopener noreferrer">
                            {skippedTranscript}
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
                <p><strong>Inclusion Read Count 1 Avg.:</strong> {selectedEvent.event.incCount1Avg.toFixed(3)}</p>
                <p><strong>Inclusion Read Count 2 Avg.:</strong> {selectedEvent.event.incCount2Avg.toFixed(3)}</p>
                <p><strong>Skipped Read Count 1 Avg.:</strong> {selectedEvent.event.skipCount1Avg.toFixed(3)}</p>
                <p><strong>Skipped Read Count 2 Avg.:</strong> {selectedEvent.event.skipCount2Avg.toFixed(3)}</p>
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
                    strain={{ name: selectedEvent.strain.name, colour: selectedEvent.strain.colour }}
                    updateOnFilter="selectedEvent"
                ></VolcanoChart>
            </div>
            {#if selectedEvent.geneEvents.length > 0}
                <div class="info-div">
                    <h4>All events for this Gene ({filteredEvents.length} events)<br>
                        Select below to view the details of each event.</h4>
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
                                <span style="text-decoration: underline;">
                                    {#if selectedEvent.event.ID === event.event.ID}
                                        <strong>{event.strain.name} (Selected)</strong>
                                    {:else}
                                        {event.strain.name}
                                    {/if}
                                </span>
                                <ul>
                                    
                                    <li style="color: {eventColours[event.event.eventType]}">Event Type: {event.event.eventType}</li>
                                    <li>FDR: {Math.abs(event.event.FDR) < 0.001 && event.event.FDR !== 0 ? event.event.FDR.toExponential(3) : event.event.FDR.toFixed(3)}</li>
                                    <li>Inclusion Level Difference (ΔΨ): {Math.abs(event.event.psiDiff) < 0.001 ? event.event.psiDiff.toExponential(3) : event.event.psiDiff.toFixed(3)}</li>
                                    <li>Inclusion Read Count 1 Avg.: {event.event.incCount1Avg.toFixed(3)}</li>
                                    <li>Inclusion Read Count 2 Avg.: {event.event.incCount2Avg.toFixed(3)}</li>
                                    <li>Skipped Read Count 1 Avg.: {event.event.skipCount1Avg.toFixed(3)}</li>
                                    <li>Skipped Read Count 2 Avg.: {event.event.skipCount2Avg.toFixed(3)}</li>
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