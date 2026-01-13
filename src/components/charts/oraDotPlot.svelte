<script lang="ts">
    import { onMount } from 'svelte';
    import type { ORAResult } from '../../../utils/ora';

    // Props
    let { 
        results, 
        title = "ORA Dot Plot",
        maxTerms = 15,
        colorBy = 'adjustedPValue'
    }: { 
        results: ORAResult[];
        title?: string;
        maxTerms?: number;
        colorBy?: 'adjustedPValue' | 'pValue' | 'enrichmentRatio';
    } = $props();

    // State
    let canvas: HTMLCanvasElement | null = null;
    let hoveredTerm: ORAResult | null = $state(null);
    
    // Constants
    const margin = { top: 40, right: 150, bottom: 60, left: 250 };
    const dotMinRadius = 3;
    const dotMaxRadius = 12;

    // Computed values
    let displayData = $derived(() => {
        return results
            .sort((a, b) => a.adjustedPValue - b.adjustedPValue)
            .slice(0, maxTerms);
    });

    function getCanvasSize() {
        if (!canvas) return { width: 0, height: 0 };
        return {
            width: canvas.width - margin.left - margin.right,
            height: canvas.height - margin.top - margin.bottom
        };
    }

    function getScales() {
        if (displayData().length === 0) return null;
        
        const { width, height } = getCanvasSize();
        
        // X-scale for enrichment ratio
        const enrichmentRatios = displayData().map((d: any) => d.enrichmentRatio);
        const xMin = Math.min(...enrichmentRatios);
        const xMax = Math.max(...enrichmentRatios);
        const xPadding = (xMax - xMin) * 0.1;
        
        const xScale = (value: number) => 
            margin.left + ((value - (xMin - xPadding)) / (xMax - xMin + 2 * xPadding)) * width;
        
        // Y-scale for gene sets (categorical)
        const yStep = height / Math.max(1, displayData().length - 1);
        const yScale = (index: number) => 
            margin.top + height - (index * yStep);
        
        // Color scale
        const colorValues = displayData().map((d: any) => {
            switch (colorBy) {
                case 'adjustedPValue': return d.adjustedPValue;
                case 'pValue': return d.pValue;
                case 'enrichmentRatio': return d.enrichmentRatio;
                default: return d.adjustedPValue;
            }
        });
        
        const colorMin = Math.min(...colorValues);
        const colorMax = Math.max(...colorValues);
        
        // Size scale based on gene count
        const geneCounts = displayData().map((d: any) => d.geneCount);
        const sizeMin = Math.min(...geneCounts);
        const sizeMax = Math.max(...geneCounts);
        
        const sizeScale = (geneCount: number) => {
            if (sizeMax === sizeMin) return (dotMinRadius + dotMaxRadius) / 2;
            const ratio = (geneCount - sizeMin) / (sizeMax - sizeMin);
            return dotMinRadius + ratio * (dotMaxRadius - dotMinRadius);
        };
        
        return { 
            xScale, 
            yScale, 
            colorMin, 
            colorMax, 
            sizeScale,
            xMin: xMin - xPadding,
            xMax: xMax + xPadding
        };
    }

    function getColor(value: number, min: number, max: number): string {
        // Color gradient from blue (low) to red (high)
        if (colorBy === 'enrichmentRatio') {
            // Higher enrichment = redder
            const ratio = (value - min) / (max - min);
            const red = Math.floor(255 * ratio);
            const blue = Math.floor(255 * (1 - ratio));
            return `rgb(${red}, 0, ${blue})`;
        } else {
            // Lower p-value = redder (more significant)
            const ratio = 1 - (value - min) / (max - min);
            const red = Math.floor(255 * ratio);
            const blue = Math.floor(255 * (1 - ratio));
            return `rgb(${red}, 0, ${blue})`;
        }
    }

    function drawDotPlot() {
        if (!canvas || displayData().length === 0) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const scales = getScales();
        if (!scales) return;
        
        const { xScale, yScale, colorMin, colorMax, sizeScale, xMin, xMax } = scales;
        const { width, height } = getCanvasSize();
        
        // Get colors
        const textColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--text-color').trim() || '#1e1e1e';
        const backgroundColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--background-color').trim() || '#ffffff';
        
        // Clear canvas
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw title
        ctx.fillStyle = textColor;
        ctx.font = 'bold 16px Inconsolata';
        ctx.textAlign = 'center';
        ctx.fillText(title, canvas.width / 2, 25);
        
        // Draw axes
        ctx.strokeStyle = textColor;
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
        ctx.font = '14px Inconsolata';
        ctx.textAlign = 'center';
        ctx.fillText('Enrichment Ratio', margin.left + width / 2, canvas.height - 20);
        
        // X-axis ticks and labels
        const xTicks = 5;
        ctx.font = '12px Inconsolata';
        for (let i = 0; i <= xTicks; i++) {
            const value = xMin + (i / xTicks) * (xMax - xMin);
            const x = xScale(value);
            
            // Tick mark
            ctx.beginPath();
            ctx.moveTo(x, margin.top + height);
            ctx.lineTo(x, margin.top + height + 5);
            ctx.stroke();
            
            // Label
            ctx.textAlign = 'center';
            ctx.fillText(value.toFixed(1), x, margin.top + height + 18);
        }
        
        // Draw gene set labels and dots
        displayData().forEach((result: ORAResult, index: number) => {
            const y = yScale(index);
            const x = xScale(result.enrichmentRatio);
            
            // Gene set label
            ctx.font = '11px Inconsolata';
            ctx.textAlign = 'right';
            ctx.fillStyle = textColor;
            
            // Truncate long names
            let displayName = result.geneSetName;
            if (displayName.length > 35) {
                displayName = displayName.substring(0, 32) + '...';
            }
            ctx.fillText(displayName, margin.left - 10, y + 4);
            
            // Dot
            const radius = sizeScale(result.geneCount);
            const colorValue = colorBy === 'adjustedPValue' ? result.adjustedPValue :
                              colorBy === 'pValue' ? result.pValue : result.enrichmentRatio;
            const dotColor = getColor(colorValue, colorMin, colorMax);
            
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fillStyle = dotColor;
            ctx.fill();
            
            // Dot border
            ctx.strokeStyle = textColor;
            ctx.lineWidth = 1;
            ctx.stroke();
            
            // Highlight hovered term
            if (hoveredTerm && hoveredTerm.geneSetId === result.geneSetId) {
                ctx.beginPath();
                ctx.arc(x, y, radius + 2, 0, Math.PI * 2);
                ctx.strokeStyle = '#FFD700';
                ctx.lineWidth = 3;
                ctx.stroke();
            }
        });
        
        // Draw legend
        drawLegend(ctx, scales);
    }

    function drawLegend(ctx: CanvasRenderingContext2D, scales: any) {
        const legendX = canvas!.width - margin.right + 20;
        const legendY = margin.top;
        
        ctx.fillStyle = getComputedStyle(document.documentElement)
            .getPropertyValue('--text-color').trim() || '#1e1e1e';
        ctx.font = 'bold 12px Inconsolata';
        ctx.textAlign = 'left';
        
        // Color legend
        ctx.fillText(`${colorBy === 'adjustedPValue' ? 'Adj. P-value' : 
                      colorBy === 'pValue' ? 'P-value' : 'Enrichment'}`, legendX, legendY);
        
        // Color gradient
        const gradientHeight = 100;
        const gradientWidth = 20;
        
        for (let i = 0; i <= gradientHeight; i++) {
            const ratio = i / gradientHeight;
            const value = scales.colorMin + ratio * (scales.colorMax - scales.colorMin);
            const color = getColor(value, scales.colorMin, scales.colorMax);
            
            ctx.strokeStyle = color;
            ctx.beginPath();
            ctx.moveTo(legendX, legendY + 20 + i);
            ctx.lineTo(legendX + gradientWidth, legendY + 20 + i);
            ctx.stroke();
        }
        
        // Color scale labels
        ctx.font = '10px Inconsolata';
        ctx.fillText(scales.colorMax.toExponential(1), legendX + gradientWidth + 5, legendY + 25);
        ctx.fillText(scales.colorMin.toExponential(1), legendX + gradientWidth + 5, legendY + 20 + gradientHeight);
        
        // Size legend
        const sizeLegendY = legendY + gradientHeight + 60;
        ctx.font = 'bold 12px Inconsolata';
        ctx.fillText('Gene Count', legendX, sizeLegendY);
        
        const geneCounts = displayData.map((d: ORAResult) => d.geneCount);
        const minGenes = Math.min(...geneCounts);
        const maxGenes = Math.max(...geneCounts);
        
        // Small dot
        ctx.beginPath();
        ctx.arc(legendX + 10, sizeLegendY + 20, scales.sizeScale(minGenes), 0, Math.PI * 2);
        ctx.fillStyle = '#666';
        ctx.fill();
        ctx.font = '10px Inconsolata';
        ctx.fillText(minGenes.toString(), legendX + 25, sizeLegendY + 25);
        
        // Large dot
        ctx.beginPath();
        ctx.arc(legendX + 10, sizeLegendY + 45, scales.sizeScale(maxGenes), 0, Math.PI * 2);
        ctx.fillStyle = '#666';
        ctx.fill();
        ctx.fillText(maxGenes.toString(), legendX + 25, sizeLegendY + 50);
    }

    function handleMouseMove(e: MouseEvent) {
        if (!canvas || displayData().length === 0) return;
        
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const mouseX = (e.clientX - rect.left) * scaleX;
        const mouseY = (e.clientY - rect.top) * scaleY;
        
        const scales = getScales();
        if (!scales) return;
        
        let closestTerm: ORAResult | null = null;
        let minDistance = Infinity;
        
        displayData().forEach((result: ORAResult, index: number) => {
            const x = scales.xScale(result.enrichmentRatio);
            const y = scales.yScale(index);
            const radius = scales.sizeScale(result.geneCount);
            
            const distance = Math.sqrt((mouseX - x) ** 2 + (mouseY - y) ** 2);
            if (distance <= radius + 5 && distance < minDistance) {
                minDistance = distance;
                closestTerm = result;
            }
        });
        
        hoveredTerm = closestTerm;
        drawDotPlot();
        
        // Update cursor
        canvas.style.cursor = hoveredTerm ? 'pointer' : 'default';
    }

    function handleMouseLeave() {
        hoveredTerm = null;
        if (canvas) canvas.style.cursor = 'default';
        drawDotPlot();
    }

    function resizeCanvas() {
        if (!canvas || !canvas.parentElement) return;
        
        const parent = canvas.parentElement;
        canvas.width = parent.clientWidth;
        canvas.height = Math.max(400, displayData().length * 30 + margin.top + margin.bottom);
        
        drawDotPlot();
    }

    onMount(() => {
        const resizeObserver = new ResizeObserver(resizeCanvas);
        if (canvas?.parentElement) {
            resizeObserver.observe(canvas.parentElement);
        }
        
        return () => resizeObserver.disconnect();
    });

    // Redraw when data changes
    $effect(() => {
        if (displayData().length > 0) {
            resizeCanvas();
        }
    });
</script>

<div class="dot-plot-container">
    <div class="controls">
        <label>
            Color by:
            <select bind:value={colorBy}>
                <option value="adjustedPValue">Adjusted P-value</option>
                <option value="pValue">P-value</option>
                <option value="enrichmentRatio">Enrichment Ratio</option>
            </select>
        </label>
        <label>
            Max terms:
            <input type="number" bind:value={maxTerms} min="5" max="50" step="5" />
        </label>
    </div>
    
    <canvas
        bind:this={canvas}
        onmousemove={handleMouseMove}
        onmouseleave={handleMouseLeave}
    ></canvas>
    
    {#if hoveredTerm}
        <div class="tooltip" style="pointer-events: none;">
            <strong>{hoveredTerm.geneSetName}</strong><br>
            <strong>Category:</strong> {hoveredTerm.category}<br>
            <strong>Enrichment Ratio:</strong> {hoveredTerm.enrichmentRatio.toFixed(2)}<br>
            <strong>Adj. P-value:</strong> {hoveredTerm.adjustedPValue.toExponential(2)}<br>
            <strong>Gene Count:</strong> {hoveredTerm.geneCount}<br>
            <strong>Genes:</strong> {hoveredTerm.geneSymbols.slice(0, 5).join(', ')}{hoveredTerm.geneSymbols.length > 5 ? '...' : ''}
        </div>
    {/if}
</div>

<style>
    .dot-plot-container {
        width: 100%;
        position: relative;
        font-family: 'Inconsolata', monospace;
    }

    .controls {
        display: flex;
        gap: 20px;
        margin-bottom: 15px;
        padding: 10px;
        background: var(--background-secondary);
        border-radius: 6px;
        flex-wrap: wrap;
    }

    .controls label {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--text-color);
        font-weight: 500;
    }

    .controls select,
    .controls input {
        padding: 4px 8px;
        border: 1px solid var(--border-color);
        border-radius: 4px;
        background: var(--background-color);
        color: var(--text-color);
        font-family: inherit;
    }

    canvas {
        width: 100%;
        border: 1px solid var(--border-color);
        border-radius: 4px;
    }

    .tooltip {
        position: absolute;
        background: var(--background-color);
        border: 1px solid var(--border-color);
        border-radius: 6px;
        padding: 10px;
        font-size: 12px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        z-index: 1000;
        max-width: 300px;
        color: var(--text-color);
        white-space: nowrap;
        
        /* Position near mouse - this would need JavaScript to work properly */
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
    }
</style>
