<script lang="ts">
    import { onMount } from 'svelte';
    import { settings } from '../states/settings';
    import { strainEventEmitter, type Event } from '../states/strains';
    import { getSelectedEvent, setSelectedEvent, updatedSelectedEvent } from '../states/selectedEvent';
    import { rootObserver } from '../rootObserver';
    import { clearTooltip, setTooltipHTML } from '../states/tooltip';

    // Component state
    let canvas: HTMLCanvasElement | null = null;
    let { data, updateOnFilter, strain }: { data: Event[]; updateOnFilter?: "strain" | "selectedEvent"; strain: { name: string; colour: string } } = $props();
    let selectedEvent = getSelectedEvent();
    let hoveredPoint: Event | null = null;
    let previousHoveredPoint: Event | null = null;
    let useReadCountFilter = $state(true);
    let filteredData = setFilteredData();
    const margin = { top: 50, right: 50, bottom: 50, left: 60 };

    function setFilteredData() {
        return useReadCountFilter ? data.filter(d => d.incCount1Avg >= settings.readCountThresh && d.incCount2Avg >= settings.readCountThresh && d.skipCount1Avg >= settings.readCountThresh && d.skipCount2Avg >= settings.readCountThresh) : data;
    }

    function getCanvasSizeAndScales() {
        if (!canvas)
            return null;
        // Plot dimensions
        const width = canvas.width - margin.left - margin.right;
        const height = canvas.height - margin.top - margin.bottom;

        // Find data ranges
        const fdr0Data = data.filter(d => d.FDR !== 0);
        
        // Check if there's valid data
        if (fdr0Data.length === 0) {
            // Return default scales if no valid data
            const xScale = () => margin.left + width/2; // Center point
            const yScale = () => margin.top + height/2; // Center point
            return { width, height, xMin: 0, xMax: 0, yMin: 0, yMax: 0, xScale, yScale };
        }
        
        // Find data ranges
        // Can't use Math.min and Math.max because of maximum call stack size exceeded errors
        const psiDiffs = data.map(d => d.psiDiff); // not fdr0Data for psiDiff because we want to show all points
        let xMin = Infinity;
        let xMax = -Infinity;
        psiDiffs.forEach(diff => {
            if (diff < xMin) xMin = diff;
            if (diff > xMax) xMax = diff;
        });
        const yMin = 0;
        let yMax = -Infinity;
        fdr0Data.forEach(d => {
            if (d.negLogFDR > yMax) yMax = d.negLogFDR;
        });
        
        // Scale functions
        const xScale = (x: number) => margin.left + ((x - xMin) / (xMax - xMin)) * width;
        const yScale = (y: number) => margin.top + height - (((isFinite(y) ? y : yMax) - yMin) / (yMax - yMin) + (isFinite(y) ? 0 : 0.025)) * height;
        return { width, height, xMin, xMax, yMin, yMax, xScale, yScale };
    }

    function drawVolcanoPlot() {
        if (!canvas || filteredData.length === 0) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const canvasSizeAndScales = getCanvasSizeAndScales();
        if (!canvasSizeAndScales) return;
        const { width, height, xMin, xMax, yMin, yMax, xScale, yScale } = canvasSizeAndScales;

        // Check if root has light or dark mode
        let root = document.querySelector(":root")!;
        const textColour = root.classList.contains("dark") ? "#fbfbfe" : "#1e1e1e";
        
        // Clear the canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw axes
        ctx.strokeStyle = textColour;
        ctx.fillStyle = textColour;
        ctx.lineWidth = 1;
        
        // X-axis
        ctx.beginPath();
        ctx.moveTo(margin.left, margin.top + height);
        ctx.lineTo(margin.left + width, margin.top + height);
        ctx.stroke();
        
        // Y-axis
        ctx.beginPath();
        ctx.moveTo(margin.left, margin.top);
        ctx.lineTo(margin.left, margin.top + height);
        ctx.stroke();
        
        // X-axis title
        ctx.textAlign = 'center';
        ctx.font = '16px Inconsolata';
        ctx.fillText('ΔΨ', margin.left + width / 2, margin.top + height + 35);
        
        // Y-axis title
        ctx.save();
        ctx.translate(margin.left - 40, margin.top + height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillText('-log10(FDR)', 0, 0);
        ctx.restore();
        
        // Draw tick marks and labels for X-axis
        const xTicks = 5;
        ctx.textAlign = 'center';
        ctx.font = '12px Inconsolata';
        for (let i = 0; i <= xTicks; i++) {
            const x = xMin + (i / xTicks) * (xMax - xMin);
            const xPos = xScale(x);
            ctx.beginPath();
            ctx.moveTo(xPos, margin.top + height);
            ctx.lineTo(xPos, margin.top + height + 5);
            ctx.stroke();
            ctx.fillText(x.toPrecision(1), xPos, margin.top + height + 20);
        }
        
        // Draw tick marks and labels for Y-axis
        const yTicks = 5;
        ctx.textAlign = 'right';
        for (let i = 0; i <= yTicks; i++) {
            const y = yMin + (i / yTicks) * (yMax - yMin);
            const yPos = yScale(y);
            ctx.beginPath();
            ctx.moveTo(margin.left, yPos);
            ctx.lineTo(margin.left - 5, yPos);
            ctx.stroke();
            ctx.fillText(y.toFixed(1), margin.left - 10, yPos + 4);
        }
        
        // Draw threshold lines
        const fdrThreshold = -Math.log10(settings.FDRThresh);
        const fcThresholdPos = settings.psiDiffThresh
        const fcThresholdNeg = -settings.psiDiffThresh
        
        // P-value threshold line
        ctx.beginPath();
        ctx.strokeStyle = 'rgb(150, 150, 150)';
        ctx.setLineDash([5, 5]);
        ctx.moveTo(margin.left, yScale(fdrThreshold));
        ctx.lineTo(margin.left + width, yScale(fdrThreshold));
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Fold change threshold lines
        ctx.beginPath();
        ctx.strokeStyle = 'rgb(150, 150, 150)';
        ctx.setLineDash([5, 5]);
        ctx.moveTo(xScale(fcThresholdPos), margin.top);
        ctx.lineTo(xScale(fcThresholdPos), margin.top + height);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(xScale(fcThresholdNeg), margin.top);
        ctx.lineTo(xScale(fcThresholdNeg), margin.top + height);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Draw data points
        filteredData.forEach(d => {
            const pointX = xScale(d.psiDiff);
            const pointY = yScale(d.negLogFDR);
            const isSignificant = d.FDR < settings.FDRThresh && 
                            Math.abs(d.psiDiff) > settings.psiDiffThresh;
            
            // Color based on significance and fold change direction
            let color = 'rgb(150, 150, 150)'; // grey for non-significant

            const readCountCheck = d.incCount1Avg >= settings.readCountThresh && d.incCount2Avg >= settings.readCountThresh && d.skipCount1Avg >= settings.readCountThresh && d.skipCount2Avg >= settings.readCountThresh;
            if (isSignificant && (!useReadCountFilter || readCountCheck))
                color = d.psiDiff > 0 ? 'rgb(255, 0, 0)' : 'rgb(0, 0, 255)';
            
            ctx.beginPath();
            ctx.arc(pointX, pointY, 3, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
        });

        if (selectedEvent) {
            const selectedX = xScale(selectedEvent.event.psiDiff);
            const selectedY = yScale(selectedEvent.event.negLogFDR); 
            ctx.beginPath();
            ctx.arc(selectedX, selectedY, 2, 0, Math.PI * 2);
            ctx.fillStyle = 'rgb(255, 255, 0)'; // Highlight selected point in yellow
            ctx.fill();
        }
    }

    function drawHoveredPoints() {
        // Change the previous ones back to red/blue/grey and the current ones to green
        if (!canvas)
            return;
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return;
        const canvasSizeAndScales = getCanvasSizeAndScales();
        if (!canvasSizeAndScales)
            return;
        const { xScale, yScale } = canvasSizeAndScales;
        ctx.lineWidth = 1;
        if (previousHoveredPoint) {
            const prevX = xScale(previousHoveredPoint.psiDiff);
            const prevY = yScale(previousHoveredPoint.negLogFDR);
            const isSignificant = previousHoveredPoint.FDR < settings.FDRThresh && 
                            Math.abs(previousHoveredPoint.psiDiff) > settings.psiDiffThresh;
            const readCountCheck = previousHoveredPoint.incCount1Avg >= settings.readCountThresh && previousHoveredPoint.incCount2Avg >= settings.readCountThresh && previousHoveredPoint.skipCount1Avg >= settings.readCountThresh && previousHoveredPoint.skipCount2Avg >= settings.readCountThresh;
           
            let prevColour = 'rgb(150, 150, 150)'; // grey for non-significant
            if (isSignificant && (!useReadCountFilter || readCountCheck))
                prevColour = previousHoveredPoint.psiDiff > 0 ? 'rgb(255, 0, 0)' : 'rgb(0, 0, 255)';

            ctx.beginPath();
            ctx.arc(prevX, prevY, 3, 0, Math.PI * 2);
            ctx.fillStyle = prevColour;
            ctx.fill();

            const genePoints = filteredData.filter(d => d.geneName === previousHoveredPoint!.geneName);
            genePoints.forEach(d => {
                const pointX = xScale(d.psiDiff);
                const pointY = yScale(d.negLogFDR);
                if (prevX === pointX && prevY === pointY)
                    return; // Skip the hovered point itself

                const pointIsSignificant = d.FDR < settings.FDRThresh && 
                            Math.abs(d.psiDiff) > settings.psiDiffThresh;
                const pointReadCountCheck = d.incCount1Avg >= settings.readCountThresh && d.incCount2Avg >= settings.readCountThresh && d.skipCount1Avg >= settings.readCountThresh && d.skipCount2Avg >= settings.readCountThresh;

                let pointColour = 'rgb(150, 150, 150)'; // grey for non-significant
                if (pointIsSignificant && (!useReadCountFilter || pointReadCountCheck))
                    pointColour = d.psiDiff > 0 ? 'rgb(255, 0, 0)' : 'rgb(0, 0, 255)';

                ctx.beginPath();
                ctx.arc(pointX, pointY, 3, 0, Math.PI * 2);
                ctx.fillStyle = pointColour;
                ctx.fill();
            });
        }
        if (hoveredPoint) {
            const hovX = xScale(hoveredPoint.psiDiff);
            const hovY = yScale(hoveredPoint.negLogFDR);
            ctx.beginPath();
            ctx.arc(hovX, hovY, 2, 0, Math.PI * 2);
            ctx.fillStyle = 'rgb(0, 255, 0)'; // Highlight hovered point in green
            ctx.fill();

            const genePoints = filteredData.filter(d => d.geneName === hoveredPoint!.geneName);
            genePoints.forEach(d => {
                const pointX = xScale(d.psiDiff);
                const pointY = yScale(d.negLogFDR);
                if (hovX === pointX && hovY === pointY)
                    return; // Skip the hovered point itself

                ctx.beginPath();
                ctx.arc(pointX, pointY, 2, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(0, 128, 0, 1)'; // Highlight hovered point in green
                ctx.fill();
            });
        }
        if (selectedEvent) {
            const selectedX = xScale(selectedEvent.event.psiDiff);
            const selectedY = yScale(selectedEvent.event.negLogFDR);
            ctx.beginPath();
            ctx.arc(selectedX, selectedY, 2, 0, Math.PI * 2);
            ctx.fillStyle = 'rgb(255, 255, 0)'; // Highlight selected point in yellow
            ctx.fill();
        }
    }
    
    // Handle mouse movement for tooltips
    function handleMouseMove(e: MouseEvent) {
        if (!canvas || filteredData.length === 0) return;
        
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        
        const canvasSizeAndScales = getCanvasSizeAndScales();
        if (!canvasSizeAndScales) return;
        const { xScale, yScale } = canvasSizeAndScales;
        
        // Find the closest point
        let minDist = Infinity;
        let closestPoint = null;
        
        for (const d of filteredData) {
            const pointX = xScale(d.psiDiff);
            const pointY = yScale(d.negLogFDR);
            const dist = Math.sqrt((x - pointX) ** 2 + (y - pointY) ** 2);
            
            if (dist < minDist && dist < 10) { // 10px threshold for hover
                minDist = dist;
                closestPoint = d;
            }
        };
        
        previousHoveredPoint = hoveredPoint;
        hoveredPoint = closestPoint;
        canvas.style.cursor = hoveredPoint ? 'pointer' : 'default';
        setTooltipHTML(hoveredPoint ? 
            `<div style="color: ${hoveredPoint.FDR < settings.FDRThresh ? Math.abs(hoveredPoint.psiDiff) > settings.psiDiffThresh ? (hoveredPoint.psiDiff > 0 ? 'rgb(255, 0, 0)' : 'rgb(0, 0, 255)') : 'rgb(150, 150, 150)' : 'rgb(150, 150, 150)'};">
                <strong>${hoveredPoint.geneName}</strong><br>
                FDR: ${hoveredPoint.FDR.toExponential(2)}<br>
                ΔΨ: ${hoveredPoint.psiDiff.toFixed(2)}
            </div>` : 
            "");
        drawHoveredPoints(); // Redraw with hover effect
    }
    
    function handleMouseLeave() {
        previousHoveredPoint = hoveredPoint;
        hoveredPoint = null;
        clearTooltip();
        if (canvas)
            canvas.style.cursor = 'default';
        drawHoveredPoints(); // Redraw without hover effect
    }

    function handleCanvasClick() {
        if (!hoveredPoint)
            return;
        setSelectedEvent({
            event: hoveredPoint,
            strain,
        });
    }

    function toggleReadCountFilter(value: boolean) {
        useReadCountFilter = value;
        filteredData = setFilteredData();
        drawVolcanoPlot();
    }

    rootObserver(drawVolcanoPlot);
    onMount(() => {
        const resizeObserver = new ResizeObserver(() => {
            if (canvas) {
                canvas.width = canvas.parentElement?.clientWidth || 300;
                canvas.height = canvas.parentElement?.clientWidth || 300;
                filteredData = setFilteredData();
                drawVolcanoPlot();
            }
        });
        if (canvas)
            resizeObserver.observe(canvas.parentElement!);
    });

    if (updateOnFilter === "strain")
        strainEventEmitter.addEventListener("updateFilteredStrains", () => {
            filteredData = setFilteredData();
            drawVolcanoPlot();
        });
    else if (updateOnFilter === "selectedEvent")
        updatedSelectedEvent.addEventListener("update", () => {
            if (selectedEvent)
                previousHoveredPoint = selectedEvent.event;
            selectedEvent = getSelectedEvent();
            if (selectedEvent?.strain.name !== strain.name)
                selectedEvent = null; // Reset if the selected event is not from the current strain
            filteredData = setFilteredData();
            drawVolcanoPlot();
            drawHoveredPoints();
        });
</script>

<div class="volcano-legend">
    <h3>Unfiltered Events Volcano Plot</h3>
    <div class="legend-item">
        <span class="legend-color significant-up"></span>
        <span>Significant Upregulated</span>
    </div>
    <div class="legend-item">
        <span class="legend-color significant-down"></span>
        <span>Significant Downregulated</span>
    </div>
    <div class="legend-item">
        <span class="legend-color not-significant"></span>
        <span>Not Significant</span>
    </div>

    <button
        onclick={() => toggleReadCountFilter(!useReadCountFilter)}
    >
        {useReadCountFilter ? 'Disable Read Count Filter' : 'Enable Read Count Filter'}
    </button>
</div>
<canvas
    bind:this={canvas}
    onmousemove={handleMouseMove}
    onmouseleave={handleMouseLeave}
    onclick={handleCanvasClick}
></canvas>

<style>
.volcano-legend {
    display: flex;
    flex-direction: column;
    padding: 10px;
}

.legend-item {
    display: flex;
    align-items: center;
    margin-bottom: 5px;
}

.legend-color {
    width: 15px;
    height: 15px;
    border-radius: 3px;
    margin-right: 5px;
}

.legend-color.significant-up {
    background-color: rgb(255, 0, 0);
}
.legend-color.significant-down {
    background-color: rgb(0, 0, 255);
}
.legend-color.not-significant {
    background-color: rgb(150, 150, 150);
}
</style>