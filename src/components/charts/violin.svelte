<script lang="ts">
    import { onMount } from 'svelte';
    import { colourScale } from '../../../utils/colour';
    import { clearTooltip, setTooltipHTML } from '../states/tooltip';
    import { strainEventEmitter } from '../states/strains';
    import { rootObserver } from '../rootObserver';
    import { updatedSelectedEvent } from '../states/selectedEvent';

    const { data, keys, updateOnFilter }: { data: number[][]; keys: string[]; updateOnFilter?: "strain" | "selectedEvent" } = $props();

    const statStorage: Record<string, {
        min: number;
        max: number;
        q1: number;
        median: number;
        q3: number;
        average: number;
        stddev: number;
        density: { x: number; y: number; }[];
    }> = {};
    const globalStats: {
        min: number;
        max: number;
    } = { min: Infinity, max: -Infinity };
    let canvas: HTMLCanvasElement | null = null;
    const padding = 40;
    const yTickCount = 5;
    const resolution = 100; // Number of points for kernel density estimation
    const bandwidthFactor = 0.5; // Factor to adjust bandwidth for violin plot width

    // Calculate kernel density estimation (Gaussian kernel)
    function kde(data: number[], min: number, max: number, iqr: number, stddev: number): {
        x: number;
        y: number;
    }[] {
        if (data.length === 0) return [];
        const range = max - min;
        
        // Create points to evaluate density
        const step = range / resolution;
        const result = [];
        let bandwidth = 0.9 * Math.min(stddev, iqr/1.35) * Math.pow(data.length, -1/5); // Silverman's rule of thumb
        bandwidth *= bandwidthFactor; // Adjust bandwidth for violin plot width
        
        for (let i = 0; i <= resolution; i++) {
            const x = min + (i * step);
            let density = 0;
            
            // Apply kernel to each data point
            for (const value of data) {
                const z = (x - value) / bandwidth;
                density += Math.exp(-0.5 * z * z) / (Math.sqrt(2 * Math.PI) * bandwidth);
            }
            
            density /= data.length;
            result.push({ x, y: density });
        }
        
        return result;
    }

    function drawViolinPlots() {
        if (keys.length === 0) return;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Check if root has light or dark mode
        let root = document.querySelector(":root")!;
        const textColour = root.classList.contains("dark") ? "#fbfbfe" : "#1e1e1e";
        const boxColour = root.classList.contains("dark") ? "#1e1e1e" : "#fbfbfe";
        
        // Clear canvas
        const width = canvas.width;
        const height = canvas.height;
        ctx.clearRect(0, 0, width, height);
        
        // Calculate plot dimensions
        const plotWidth = (width - padding) / keys.length;
        
        // Find global min and max values for consistent scaling
        globalStats.min = Infinity;
        globalStats.max = -Infinity;

        let globalMaxDensity = 0;
        
        for (let i = 0; i < keys.length; i++) {
            if (data[i].length === 0) continue;

            // Get statistics for each dataset
            const sortedValues = [...data[i]].sort((a, b) => a - b);
            const q1 = sortedValues[Math.floor(sortedValues.length * 0.25)];
            const median = sortedValues[Math.floor(sortedValues.length * 0.5)];
            const q3 = sortedValues[Math.floor(sortedValues.length * 0.75)];
            const min = sortedValues[0];
            const max = sortedValues[sortedValues.length - 1];
            
            const average = sortedValues.reduce((sum, value) => sum + value, 0) / sortedValues.length;
            const stddev = Math.sqrt(sortedValues.reduce((sum, value) => sum + (value - average) ** 2, 0) / sortedValues.length);

            // Calculate KDE for this dataset
            const density = kde(data[i], min, max, q3 - q1, stddev);
            globalMaxDensity = Math.max(globalMaxDensity, ...density.map(d => d.y));

            statStorage[keys[i]] = { min, max, q1, median, q3, density, average, stddev };

            if (min < globalStats.min) globalStats.min = min;
            if (max > globalStats.max) globalStats.max = max;
        }
        
        // Draw axes
        ctx.strokeStyle = textColour;
        ctx.fillStyle = textColour;
        ctx.lineWidth = 1;
        
        // Axes
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, height - padding);
        ctx.lineTo(width, height - padding);
        ctx.stroke();
        
        // Y-axis ticks and labels
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let i = 0; i <= yTickCount; i++) {
            const y = padding + ((height - padding - padding) * (yTickCount - i)) / yTickCount;
            const value = globalStats.min + (i / yTickCount) * (globalStats.max - globalStats.min);
            
            ctx.beginPath();
            ctx.moveTo(padding - 5, y);
            ctx.lineTo(padding, y);
            ctx.stroke();
            
            ctx.fillText(value.toFixed(1), padding - 10, y);
        }

        keys.forEach((key, index) => {
            if (!data[index] || data[index].length === 0) return;
            
            // Find maximum density for scaling
            const { density } = statStorage[key];
            
            // Calculate x-position for this violin
            const xCenter = padding + (index + 0.5) * plotWidth;
            
            // Draw violin
            ctx.fillStyle = colourScale[index % colourScale.length];
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.lineWidth = 1;
            
            ctx.beginPath();
            
            // Map the first point
            const firstPoint = density[0];
            const firstY = height - padding - ((firstPoint.x - globalStats.min) / (globalStats.max - globalStats.min)) * (height - padding - padding);
            ctx.moveTo(xCenter, firstY);
            
            // Right side of violin
            for (const point of density) {
                const y = height - padding - ((point.x - globalStats.min) / (globalStats.max - globalStats.min)) * (height - padding - padding);
                const halfWidth = (point.y / globalMaxDensity) * (plotWidth * 0.4);
                ctx.lineTo(xCenter + halfWidth, y);
            }
            
            // Left side of violin (in reverse)
            for (let i = density.length - 1; i >= 0; i--) {
                const point = density[i];
                const y = height - padding - ((point.x - globalStats.min) / (globalStats.max - globalStats.min)) * (height - padding - padding);
                const halfWidth = (point.y / globalMaxDensity) * (plotWidth * 0.4);
                ctx.lineTo(xCenter - halfWidth, y);
            }
            
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            
            // Draw x-axis label
            ctx.fillStyle = textColour;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(`${key} (${data[index].length} values)`, xCenter, height - padding + 10);

            // Draw box plot overlay
            const yQ1 = height - padding - ((statStorage[key].q1 - globalStats.min) / (globalStats.max - globalStats.min)) * (height - padding - padding);
            const yMedian = height - padding - ((statStorage[key].median - globalStats.min) / (globalStats.max - globalStats.min)) * (height - padding - padding);
            const yQ3 = height - padding - ((statStorage[key].q3 - globalStats.min) / (globalStats.max - globalStats.min)) * (height - padding - padding);

            const IQR = statStorage[key].q3 - statStorage[key].q1;

            const yMin = height - padding - ((Math.max(statStorage[key].min, statStorage[key].q1 - 1.5 * IQR) - globalStats.min) / (globalStats.max - globalStats.min)) * (height - padding - padding);
            const yMax = height - padding - ((Math.min(statStorage[key].max, statStorage[key].q3 + 1.5 * IQR) - globalStats.min) / (globalStats.max - globalStats.min)) * (height - padding - padding);
            
            // Box
            const boxWidth = plotWidth * 0.075;
            ctx.fillStyle = boxColour;
            ctx.fillRect(xCenter - boxWidth/2, yQ3, boxWidth, yQ1 - yQ3);
            
            // Outline and median
            ctx.strokeStyle = textColour;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.rect(xCenter - boxWidth/2, yQ3, boxWidth, yQ1 - yQ3);
            ctx.moveTo(xCenter - boxWidth/2, yMedian);
            ctx.lineTo(xCenter + boxWidth/2, yMedian);
            ctx.stroke();

            // Whiskers and connecting them to box
            ctx.beginPath();
            ctx.moveTo(xCenter, yMin);
            ctx.lineTo(xCenter - boxWidth/3, yMin);
            ctx.lineTo(xCenter + boxWidth/3, yMin);
            ctx.moveTo(xCenter, yMin);
            ctx.lineTo(xCenter, yMax);
            ctx.lineTo(xCenter - boxWidth/3, yMax);
            ctx.lineTo(xCenter + boxWidth/3, yMax);
            ctx.stroke();
        });
    }

    function tooltipNumber(value: number): string {
        return value === 0 || Math.abs(value) > 0.001 ?
            value.toFixed(3) :
            value.toExponential(3);
    }

    function handleMouseMove(event: MouseEvent) {
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;

        // Get y value from mouse position and the kde values of all graphs at that position
        const y = event.clientY - rect.top - padding;
        const yRange = rect.height - 2 * padding;
        const yValue = globalStats.max - (y / yRange) * (globalStats.max - globalStats.min);
        let densityInfos = "";
        if (yValue >= globalStats.min && yValue <= globalStats.max) {
            densityInfos = `Density at ${tooltipNumber(yValue)}: `;
            for (const key of keys) {
                const stats = statStorage[key];
                // Interpolate density value at yValue as needed
                let closestMinValue = stats.density[0];
                for (const point of stats.density) {
                    if (point.x >= yValue) {
                        // If neither of them are the same, interpolate
                        if (point.x === yValue) {
                            densityInfos += `<span style="color: ${colourScale[keys.indexOf(key) % colourScale.length]}"><strong>${key}</strong>: ${tooltipNumber(point.y)}; </span>`;
                        } else {
                            const densityVal = closestMinValue.y * (point.x - yValue) / (point.x - closestMinValue.x) + point.y * (closestMinValue.x - yValue) / (closestMinValue.x - point.x);
                            if (!isNaN(densityVal) && isFinite(densityVal))
                                densityInfos += `<span style="color: ${colourScale[keys.indexOf(key) % colourScale.length]}"><strong>${key}</strong>: ${tooltipNumber(densityVal)}; </span>`;
                        }
                        break;
                    }
                    closestMinValue = point;
                }
            }
        }

        // Check if mouse is over any violin plot
        const plotWidth = (rect.width - padding) / keys.length;
        for (let i = 0; i < keys.length; i++) {
            const xCenter = padding + (i + 0.5) * plotWidth;
            if (x >= xCenter - plotWidth * 0.5 && x <= xCenter + plotWidth * 0.5) {
                const stats = statStorage[keys[i]];
                setTooltipHTML(`<strong>${keys[i]}</strong><br>IQR: ${tooltipNumber(stats.q3 - stats.q1)}<br>Min: ${tooltipNumber(stats.min)}<br>Q1: ${tooltipNumber(stats.q1)}<br>Median: ${tooltipNumber(stats.median)}<br>Q3: ${tooltipNumber(stats.q3)}<br>Max: ${tooltipNumber(stats.max)}<br><br>${densityInfos}`);
                return;
            }
        }

        clearTooltip();
    }

    function handleMouseLeave() {
        clearTooltip();
    }

    rootObserver(drawViolinPlots);
    if (updateOnFilter === "strain")
        strainEventEmitter.addEventListener("updateFilteredStrains", drawViolinPlots);
    else if (updateOnFilter === "selectedEvent")
        updatedSelectedEvent.addEventListener("update", drawViolinPlots);
    onMount(() => {
        const resizeObserver = new ResizeObserver(() => {
            if (canvas) {
                canvas.width = canvas.parentElement?.clientWidth || 300;
                canvas.height = (canvas.parentElement?.clientWidth || 300) / 2;
                drawViolinPlots();
            }
        });
        if (canvas)
            resizeObserver.observe(canvas.parentElement!);
    });
</script>

<canvas
    bind:this={canvas}
    onmousemove={handleMouseMove}
    onmouseleave={handleMouseLeave}
></canvas>
