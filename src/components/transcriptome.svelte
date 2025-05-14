<script lang="ts">
    import { type Event as ASEvent, type SEEvent, type MXEEvent, type ASSEvent, type RIEvent, eventTypes, getFilteredStrains, getStrains, toggleStrainVisibility, updatedFilteredStrains } from "./states/strains.svelte";
    import { getPositionsFromData } from "./eventHelpers";
    import { rootObserver } from "./rootObserver";
    import { settings } from "./states/settings.svelte";
    import { setSelectedEvent } from "./states/selectedEvent.svelte";
    import { clearTooltip, setTooltipHTML } from "./states/tooltip.svelte";

    let canvas: HTMLCanvasElement | null = $state(null);

    let hoveredPoint: { event: ASEvent; strain: { name: string; colour: string; } } | null = null;

    let zoomLevel = 1;
    let xOffset = 0;
    let drag = false;

    let geneLabels: { x: number; y: number; text: string; textWidth: number; event: ASEvent; strain: { name: string; colour: string; } }[] = [];
    let geneRegions: { x1: number; x2: number; y1: number; y2: number; event: ASEvent; strain: { name: string; colour: string; } }[] = [];

    export function renderVisualization() {
        if (!canvas)
            return;
        const ctx = canvas.getContext("2d");
        if (!ctx)
            return;

        // Check if root has light or dark mode
        let root = document.querySelector(":root")!;
        const textColour = root.classList.contains("dark") ? "#fbfbfe" : "#1e1e1e";

        // Get screen width and height
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        const canvasWidth = Math.max(screenWidth - 40, 1200);
        const canvasHeight = Math.max(screenHeight, 400);
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const filteredStrains = getFilteredStrains();

        let minPos = Infinity;
        let maxPos = -Infinity;
        
        geneLabels = [];
        geneRegions = [];
        
        filteredStrains.forEach(([_, { events }]) => {
            for (const eventType of eventTypes) {
                if (settings.selectedEvent !== "All" && settings.selectedEvent !== eventType)
                    continue;

                events.forEach(event => {
                    // Extract coordinates based on splicing type
                    const positions = getPositionsFromData(event);
                    const startPos = positions.start;
                    const endPos = positions.end;
                    
                    if (isFinite(startPos) && isFinite(endPos)) {
                        minPos = Math.min(minPos, startPos);
                        maxPos = Math.max(maxPos, endPos);
                    }
                });
            }
        });
        
        // Set default if no data found
        if (minPos === Infinity) minPos = 0;
        if (maxPos === -Infinity) maxPos = 1000000;
        
        // Apply zoom and offset
        const totalRange = maxPos - minPos;
        const visibleRange = totalRange / zoomLevel;
        const adjustedMin = minPos + xOffset * totalRange;
        const adjustedMax = adjustedMin + visibleRange;
        
        // Calculate scale factor
        const scale = canvas.width / (adjustedMax - adjustedMin);
        
        // Reserve space for x-axis at the bottom
        const axisHeight = 30;
        const mainHeight = canvas.height - axisHeight;
        
        // Draw lines for each strain
        const lineSpacing = mainHeight / (filteredStrains.length + 1);
        const lineStartY = lineSpacing;
        const lineHeight = 2;
        
        for (let strainIndex = 0; strainIndex < filteredStrains.length; strainIndex++) {
            const [name, {colour, events}] = filteredStrains[strainIndex];
            const lineY = lineStartY + strainIndex * lineSpacing;
            
            // Draw strain label
            ctx.fillStyle = textColour;
            ctx.font = "14px Inconsolata";
            ctx.fillText(name, 10, lineY - 10);
            
            // Draw baseline
            ctx.strokeStyle = textColour;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, lineY);
            ctx.lineTo(canvas.width, lineY);
            ctx.stroke();
            
            // Draw gene regions
            ctx.fillStyle = colour;

            events.forEach(event => {
                // Extract coordinates based on splicing type
                const positions = getPositionsFromData(event);
                const startPos = positions.start;
                const endPos = positions.end;
                
                // Only draw if within visible range and has valid positions
                if (isFinite(startPos) && isFinite(endPos) && startPos <= adjustedMax && endPos >= adjustedMin) {
                    const x1 = Math.max(0, (startPos - adjustedMin) * scale);
                    const x2 = Math.min(canvas!.width, (endPos - adjustedMin) * scale);
                    
                    ctx.fillRect(x1, lineY - lineHeight * 2, x2 - x1, lineHeight * 4);
                    
                    // Store gene region for hover detection
                    geneRegions.push({
                        x1,
                        x2,
                        y1: lineY - lineHeight * 2,
                        y2: lineY + lineHeight * 2,
                        event,
                        strain: { name, colour },
                    });
                    
                    // Add gene labels (only for important genes and not too crowded)
                    const geneId = event.geneName || event.geneID;
                    if (geneId && geneLabels.length < 100) {
                        const centerX = (x1 + x2) / 2;
                        
                        // Calculate actual text width using the canvas context
                        const textWidth = event.textWidth || ctx.measureText(geneId).width;
                        
                        // Check if we already have a label near this position
                        let tooClose = false;
                        for (let i = 0; i < geneLabels.length; i++) {
                            // Use the actual width of the existing label
                            const existingTextWidth = geneLabels[i].textWidth;
                            
                            // Check if the labels would overlap or be too close
                            const minSpaceBetween = 5; // Minimum pixels between labels
                            const existingStart = geneLabels[i].x - existingTextWidth/2;
                            const existingEnd = geneLabels[i].x + existingTextWidth/2;
                            const newStart = centerX - textWidth/2;
                            const newEnd = centerX + textWidth/2;
                            
                            // Check horizontal overlap plus buffer
                            const horizontalOverlap = (
                                (newStart <= existingEnd + minSpaceBetween) && 
                                (newEnd >= existingStart - minSpaceBetween)
                            );
                            
                            // Check vertical proximity
                            const verticalProximity = Math.abs(geneLabels[i].y - (lineY + 10)) < 15;
                            
                            if (horizontalOverlap && verticalProximity) {
                                tooClose = true;
                                break;
                            }
                        }
                        
                        if (!tooClose)
                            geneLabels.push({
                                text: geneId,
                                textWidth,
                                x: centerX,
                                y: lineY + 15,
                                event,
                                strain: { name, colour },
                            });
                    }
                }
            });
        }
        
        // Draw gene labels
        ctx.font = "10px Inconsolata";
        ctx.fillStyle = textColour;
        for (const label of geneLabels) {
            // Center the text at the specified x coordinate
            ctx.textAlign = "center";
            ctx.fillText(label.text, label.x, label.y);
        }
        
        // X axis
        ctx.strokeStyle = textColour;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(canvas.width, 0);
        ctx.stroke();
        
        ctx.fillStyle = textColour;
        ctx.font = "10px Inconsolata";
        ctx.textAlign = "center";
        
        const range = adjustedMax - adjustedMin;
        const tickCount = 20;
        const tickInterval = range / tickCount;
        
        for (let i = 0; i <= tickCount; i++) {
            const position = adjustedMin + i * tickInterval;
            const x = (i / tickCount) * canvas.width;
            
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, 5);
            ctx.stroke();
            
            const label = Math.round(position);
            ctx.fillText(label.toString(), x, 15);
        }
        
        ctx.textAlign = "left";
        ctx.font = "12px Inconsolata";
        ctx.fillText(settings.selectedChr === "All" ? "Position (bp)" : `${settings.selectedChr} Position (bp)`, 5, 25);
    }

    /// INTERACTIVITY HANDLERS ///
    
    function handleMouseDown(event: MouseEvent) {
        if (!canvas)
            return;
        drag = true;
        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseProportion = mouseX / canvas.width;
        xOffset = Math.max(0, Math.min(1 - (1/zoomLevel), mouseProportion));
    };

    function handleMouseUpOrLeave() {
        drag = false;
    };

    function handleMouseMove(event: MouseEvent) {
        if (!canvas)
            return;
            
        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        // Drag functionality, move from previous xOffset
        if (drag) {
            const mouseProportion = mouseX / canvas.width;
            const newOffset = Math.max(0, Math.min(1 - (1/zoomLevel), mouseProportion));
            xOffset = newOffset;
            clearTooltip();
            hoveredPoint = null;
            renderVisualization();
            return;
        }
        
        // Check if mouse is over a gene label
        let foundLabel = null;
        for (const label of geneLabels) {
            const textWidth = label.textWidth;
            if (mouseX >= label.x - textWidth/2 && mouseX <= label.x + textWidth/2 &&
                mouseY >= label.y - 10 && mouseY <= label.y + 2) {
                foundLabel = label;
                break;
            }
        }
        
        // Check if mouse is over a gene region
        let foundRegion = null;
        if (!foundLabel)
            for (const region of geneRegions)
                if (mouseX >= region.x1 && mouseX <= region.x2 &&
                    mouseY >= region.y1 && mouseY <= region.y2) {
                    foundRegion = region;
                    break;
                }
        if (foundLabel || foundRegion) {
            const data = foundLabel ? foundLabel.event : foundRegion!.event;
            const strain = foundLabel ? foundLabel.strain : foundRegion!.strain;
            
            let tooltipContent = `
                <strong>Gene:</strong> ${data.geneName || data.geneID || "Unknown"}<br>
                <strong>Strain:</strong> ${strain.name}<br>
                <strong>Chromosome:</strong> ${data.chr}${data.strand ? " (" + data.strand + ")" : ""}<br>
                <strong>Event Type:</strong> ${data.eventType}<br>
                <strong>P-Value:</strong> ${data.pVal.toExponential(3)}<br>
                <strong>FDR:</strong> ${data.FDR.toExponential(3)}<br>
                <strong>Inc Level Diff:</strong> ${data.psiDiff.toFixed(3)}<br>
            `;
            
            // Add specific information based on splicing type
            switch (data.eventType) {
                case "SE":
                    const seData = data as SEEvent;
                    tooltipContent += `
                        <strong>Exon (bp):</strong> ${seData.exonStart}-${seData.exonEnd}<br>
                        <strong>Upstream (bp):</strong> ${seData.upstreamExonStart}-${seData.upstreamExonEnd}<br>
                        <strong>Downstream (bp):</strong> ${seData.downstreamExonStart}-${seData.downstreamExonEnd}<br>
                    `;
                    break;
                    
                case "MXE":
                    const mxeData = data as MXEEvent;
                    tooltipContent += `
                        <strong>First Exon (bp):</strong> ${mxeData.exon1Start}-${mxeData.exon1End}<br>
                        <strong>Second Exon (bp):</strong> ${mxeData.exon2Start}-${mxeData.exon2End}<br>
                        <strong>Upstream (bp):</strong> ${mxeData.upstreamExonStart}-${mxeData.upstreamExonEnd}<br>
                        <strong>Downstream (bp):</strong> ${mxeData.downstreamExonStart}-${mxeData.downstreamExonEnd}<br>
                    `;
                    break;
                    
                case "A3SS":
                case "A5SS":
                    const assData = data as ASSEvent;
                    tooltipContent += `
                        <strong>Long Exon (bp):</strong> ${assData.longExonStart}-${assData.longExonEnd}<br>
                        <strong>Short Exon (bp):</strong> ${assData.shortExonStart}-${assData.shortExonEnd}<br>
                        <strong>Flanking (bp):</strong> ${assData.flankingExonStart}-${assData.flankingExonEnd}<br>
                    `;
                    break;
                    
                case "RI":
                    const riData = data as RIEvent;
                    tooltipContent += `
                        <strong>RI Exon (bp):</strong> ${riData.riExonStart}-${riData.riExonEnd}<br>
                        <strong>Upstream (bp):</strong> ${riData.upstreamExonStart}-${riData.upstreamExonEnd}<br>
                        <strong>Downstream (bp):</strong> ${riData.downstreamExonStart}-${riData.downstreamExonEnd}<br>
                    `;
                    break;
            }
            
            setTooltipHTML(tooltipContent);
            
            canvas.style.cursor = "pointer";
            hoveredPoint = {
                event: data,
                strain: strain,
            };
        } else {
            clearTooltip();
            canvas.style.cursor = "default";
            hoveredPoint = null;
        }
    }

    function handleCanvasClick() {
        if (!hoveredPoint)
            return;
        setSelectedEvent(hoveredPoint);
    }

    function handleWheel(event: WheelEvent) {
        if (!canvas)
            return;

        event.preventDefault();

        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        
        const mouseProportion = mouseX / canvas.width;
        
        const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
        const newZoomLevel = Math.min(100000, Math.max(1, zoomLevel * zoomFactor));
        
        const oldVisibleProportion = 1 / zoomLevel;
        const newVisibleProportion = 1 / newZoomLevel;
        const oldOffset = xOffset;
        const offsetUnderMouse = oldOffset + mouseProportion * oldVisibleProportion;
        const newOffset = offsetUnderMouse - mouseProportion * newVisibleProportion;
        
        zoomLevel = newZoomLevel;
        xOffset = Math.max(0, Math.min(1 - (1/zoomLevel), newOffset));
        renderVisualization();
    }

    $effect(() => renderVisualization());
    updatedFilteredStrains.addEventListener("update", renderVisualization);
    rootObserver(renderVisualization);
</script>

{#if getStrains().length > 0}
    <div class="visualization_box">
        <div class="legend">
            {#each getStrains() as strain, i}
                <div
                    onclick={() => toggleStrainVisibility(i)}
                    onkeydown={() => toggleStrainVisibility(i)}
                    tabindex="-1"
                    role="button"
                    style="text-decoration: {strain.visible ? 'none' : 'line-through'}"
                >
                    <span
                        class="color-box"
                        style="background-color: {strain.colour}; display: {strain.visible ? 'inline-block' : 'none'};"
                    ></span> {strain.name}
                </div>
            {/each}
        </div>
        <canvas
            bind:this={canvas}
            onmousedown={handleMouseDown}
            onmouseup={handleMouseUpOrLeave}
            onmouseleave={handleMouseUpOrLeave}
            onmousemove={handleMouseMove}
            onclick={handleCanvasClick}
            onwheel={handleWheel}
        ></canvas>
    </div>
{/if}

<style>
.visualization_box {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    width: 100%;
}

.legend {
    margin-bottom: 10px;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
}

.legend div {
    display: flex;
    align-items: center;
    margin-right: 15px;
    cursor: pointer;
}

.color-box {
    display: inline-block;
    width: 15px;
    height: 15px;
    margin-right: 5px;
    vertical-align: middle;
}

canvas {
    border: 1px solid #ddd;
    cursor: default;
}
</style>