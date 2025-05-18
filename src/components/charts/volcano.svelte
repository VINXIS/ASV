<script lang="ts">
    import { onMount } from 'svelte';
    import { settings } from '../states/settings';
    import { strainEventEmitter, type Event } from '../states/strains';
    import { setSelectedEvent } from '../states/selectedEvent';
  import { rootObserver } from '../rootObserver';

    // Component state
    let canvas: HTMLCanvasElement | null = null;
    let { data, updateOnFilter, strain }: { data: Event[]; updateOnFilter: boolean; strain: { name: string; colour: string } } = $props();
    let hoveredPoint: Event | null = null;
    const margin = { top: 50, right: 50, bottom: 50, left: 60 };

    function getCanvasSizeAndScales() {
        if (!canvas)
            return null;
        // Plot dimensions
        const width = canvas.offsetWidth - margin.left - margin.right;
        const height = canvas.offsetHeight - margin.top - margin.bottom;
        
        // Find data ranges
        const xMin = Math.min(...data.filter(d => d.FDR !== 0).map(d => d.psiDiff));
        const xMax = Math.max(...data.filter(d => d.FDR !== 0).map(d => d.psiDiff));
        const yMin = 0;
        const yMax = Math.max(...data.filter(d => d.FDR !== 0).map(d => d.negLogFDR));
        
        // Scale functions
        const xScale = (x: number) => margin.left + ((x - xMin) / (xMax - xMin)) * width;
        const yScale = (y: number) => margin.top + height - ((y - yMin) / (yMax - yMin)) * height;
        return { width, height, xMin, xMax, yMin, yMax, xScale, yScale };
    }

    function drawVolcanoPlot() {
        if (!canvas || data.length === 0) return;

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
        
        // Graph title
        ctx.textAlign = 'center';
        ctx.font = 'bold 18px Inconsolata';
        ctx.fillText('Volcano Plot', margin.left + width / 2, 25);
        
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
            ctx.fillText(x.toFixed(1), xPos, margin.top + height + 20);
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
        ctx.strokeStyle = 'rgba(150, 150, 150, 0.5)';
        ctx.setLineDash([5, 5]);
        ctx.moveTo(margin.left, yScale(fdrThreshold));
        ctx.lineTo(margin.left + width, yScale(fdrThreshold));
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Fold change threshold lines
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(150, 150, 150, 0.5)';
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
        data.forEach(d => {
            const pointX = xScale(d.psiDiff);
            const pointY = yScale(d.negLogFDR);
            const isSignificant = d.FDR < settings.FDRThresh && 
                            Math.abs(d.psiDiff) > settings.psiDiffThresh;
            
            // Color based on significance and fold change direction
            let color = 'rgba(150, 150, 150, 0.7)'; // grey for non-significant
            
            if (isSignificant)
                color = d.psiDiff > 0 ? 'rgba(255, 0, 0, 0.7)' : 'rgba(0, 0, 255, 0.7)';
            
            // Check if this is the hovered point
            if (hoveredPoint && hoveredPoint.geneName === d.geneName && isSignificant) {
                ctx.beginPath();
                ctx.arc(pointX, pointY, 5, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(0, 255, 0, 0.7)';
                ctx.fill();
                
                // Draw label for hovered point
                ctx.fillStyle = textColour;
                ctx.textAlign = 'left';
                ctx.font = '12px Inconsolata';
                ctx.fillText(`${d.geneName} (FDR=${d.FDR.toExponential(2)}, ΔΨ=${d.psiDiff.toFixed(2)})`, pointX + 8, pointY - 8);
            } else {
                // Draw normal point
                ctx.beginPath();
                ctx.arc(pointX, pointY, 3, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
            }
        });
    }
    
    // Handle mouse movement for tooltips
    function handleMouseMove(e: MouseEvent) {
        if (!canvas || data.length === 0) return;
        
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const canvasSizeAndScales = getCanvasSizeAndScales();
        if (!canvasSizeAndScales) return;
        const { xScale, yScale } = canvasSizeAndScales;
        
        // Find the closest point
        let minDist = Infinity;
        let closestPoint = null;
        
        data.forEach(d => {
            const pointX = xScale(d.psiDiff);
            const pointY = yScale(d.negLogFDR);
            const dist = Math.sqrt((x - pointX) ** 2 + (y - pointY) ** 2);
            
            if (dist < minDist && dist < 10) { // 10px threshold for hover
                minDist = dist;
                closestPoint = d;
            }
        });
        
        hoveredPoint = closestPoint;
        canvas.style.cursor = hoveredPoint ? 'pointer' : 'default';
        drawVolcanoPlot(); // Redraw with hover effect
    }
    
    function handleMouseLeave() {
        hoveredPoint = null;
        if (canvas)
            canvas.style.cursor = 'default';
        drawVolcanoPlot(); // Redraw without hover effect
    }

    function handleCanvasClick() {
        if (!hoveredPoint)
            return;
        setSelectedEvent({
            event: hoveredPoint,
            strain,
        });
    }

    rootObserver(drawVolcanoPlot);
    onMount(() => {
        const resizeObserver = new ResizeObserver(() => {
            if (canvas) {
                canvas.width = canvas.parentElement?.clientWidth || 300;
                canvas.height = canvas.parentElement?.clientWidth || 300;
                drawVolcanoPlot();
            }
        });
        if (canvas)
            resizeObserver.observe(canvas.parentElement!);
    });
    if (updateOnFilter)
        strainEventEmitter.addEventListener("updateFilteredStrains", drawVolcanoPlot);
</script>
<div class="volcano-legend">
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
    background-color: rgba(255, 0, 0, 0.7);
}
.legend-color.significant-down {
    background-color: rgba(0, 0, 255, 0.7);
}
.legend-color.not-significant {
    background-color: rgba(150, 150, 150, 0.7);
}
</style>