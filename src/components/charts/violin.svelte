<script lang="ts">
    import { onMount } from 'svelte';
  import { colourScale } from '../../../utils/colour';
  import { rootObserver } from '../rootObserver';
  import { setTooltipHTML } from '../states/tooltip.svelte';

    let { data }: { data: Record<string, { min: number; max: number; values: number[] }> } = $props();

    let canvas: HTMLCanvasElement | null = $state(null);
    const padding = {
        top: 10,
        right: 10,
        bottom: 10,
        left: 10
    }

    // Calculate kernel density estimation (Gaussian kernel)
    function kde(data: { min: number; max: number; values: number[] }, bandwidth = 0.2): {
        x: number;
        y: number;
    }[] {
        const { min, max, values } = data;
        const range = max - min;
        
        // Create points to evaluate density
        const points = 50;
        const step = range / points;
        const result = [];
        
        for (let i = 0; i <= points; i++) {
            const x = min + (i * step);
            let density = 0;
            
            // Apply kernel to each data point
            for (const value of values) {
                const z = (x - value) / bandwidth;
                density += Math.exp(-0.5 * z * z) / (Math.sqrt(2 * Math.PI) * bandwidth);
            }
            
            density /= values.length;
            result.push({ x, y: density });
        }
        
        return result;
    }

    function drawViolinPlots() {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const keys = Object.keys(data);
        if (keys.length === 0) return;

        // Check if root has light or dark mode
        let root = document.querySelector(":root")!;
        const textColour = root.classList.contains("dark") ? "#fbfbfe" : "#1e1e1e";
        
        // Clear canvas
        const width = canvas.width;
        const height = canvas.height;
        ctx.clearRect(0, 0, width, height);
        
        // Calculate plot dimensions
        const plotWidth = width / keys.length;
        
        // Find global min and max values for consistent scaling
        let globalMin = Infinity;
        let globalMax = -Infinity;
        
        for (const key of keys) {
            const { min, max, values } = data[key];
            if (values.length === 0) continue;

            if (min < globalMin) globalMin = min;
            if (max > globalMax) globalMax = max;
        }
        
        // Add some padding to min/max
        const range = globalMax - globalMin;
        globalMin -= range * 0.05;
        globalMax += range * 0.05;
        
        // Draw axes
        ctx.strokeStyle = textColour;
        ctx.lineWidth = 1;
        
        // Y-axis
        ctx.beginPath();
        ctx.moveTo(padding.left, padding.top);
        ctx.lineTo(padding.left, height - padding.bottom);
        ctx.stroke();
        
        // Y-axis ticks and labels
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        const yTickCount = 5;
        for (let i = 0; i <= yTickCount; i++) {
            const y = padding.top + ((height - padding.top - padding.bottom) * (yTickCount - i)) / yTickCount;
            const value = globalMin + (i / yTickCount) * (globalMax - globalMin);
            
            ctx.beginPath();
            ctx.moveTo(padding.left - 5, y);
            ctx.lineTo(padding.left, y);
            ctx.stroke();
            
            ctx.fillText(value.toFixed(1), padding.left - 10, y);
        }
        
        // X-axis
        ctx.beginPath();
        ctx.moveTo(padding.left, height - padding.bottom);
        ctx.lineTo(width - padding.right, height - padding.bottom);
        ctx.stroke();

        keys.forEach((key, index) => {
            const { values } = data[key];
            if (!values || values.length === 0) return;
            
            // Calculate KDE for this dataset
            const density = kde(data[key]);
            
            // Find maximum density for scaling
            const maxDensity = Math.max(...density.map(d => d.y));
            
            // Calculate x-position for this violin
            const xCenter = padding.left + (index + 0.5) * plotWidth;
            
            // Draw violin
            ctx.fillStyle = colourScale[index % colourScale.length];
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.lineWidth = 1;
            
            ctx.beginPath();
            
            // Map the first point
            const firstPoint = density[0];
            const firstY = height - padding.bottom - ((firstPoint.x - globalMin) / (globalMax - globalMin)) * (height - padding.top - padding.bottom);
            ctx.moveTo(xCenter, firstY);
            
            // Right side of violin
            for (const point of density) {
                const y = height - padding.bottom - ((point.x - globalMin) / (globalMax - globalMin)) * (height - padding.top - padding.bottom);
                const halfWidth = (point.y / maxDensity) * (plotWidth * 0.4);
                ctx.lineTo(xCenter + halfWidth, y);
            }
            
            // Left side of violin (in reverse)
            for (let i = density.length - 1; i >= 0; i--) {
                const point = density[i];
                const y = height - padding.bottom - ((point.x - globalMin) / (globalMax - globalMin)) * (height - padding.top - padding.bottom);
                const halfWidth = (point.y / maxDensity) * (plotWidth * 0.4);
                ctx.lineTo(xCenter - halfWidth, y);
            }
            
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            
            // Draw box plot elements inside violin
            const sortedValues = [...values].sort((a, b) => a - b);
            const q1 = sortedValues[Math.floor(sortedValues.length * 0.25)];
            const median = sortedValues[Math.floor(sortedValues.length * 0.5)];
            const q3 = sortedValues[Math.floor(sortedValues.length * 0.75)];
            
            // Map values to y positions
            const yQ1 = height - padding.bottom - ((q1 - globalMin) / (globalMax - globalMin)) * (height - padding.top - padding.bottom);
            const yMedian = height - padding.bottom - ((median - globalMin) / (globalMax - globalMin)) * (height - padding.top - padding.bottom);
            const yQ3 = height - padding.bottom - ((q3 - globalMin) / (globalMax - globalMin)) * (height - padding.top - padding.bottom);
            
            // Draw median line
            ctx.beginPath();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.moveTo(xCenter - plotWidth * 0.15, yMedian);
            ctx.lineTo(xCenter + plotWidth * 0.15, yMedian);
            ctx.stroke();
            
            // Draw quartile points
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(xCenter, yQ1, 2, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.beginPath();
            ctx.arc(xCenter, yQ3, 2, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw x-axis label
            ctx.fillStyle = textColour;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(key, xCenter, height - padding.bottom + 15);
        });
    }

    function handleMouseMove(event: MouseEvent) {
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // Check if mouse is over any violin plot
        const keys = Object.keys(data);
        const plotWidth = (rect.width - padding.left - padding.right) / keys.length;

        for (let i = 0; i < keys.length; i++) {
            const xCenter = padding.left + (i + 0.5) * plotWidth;
            if (x >= xCenter - plotWidth * 0.5 && x <= xCenter + plotWidth * 0.5) {
                setTooltipHTML(`<strong>${keys[i]}</strong><br>Min: ${data[keys[i]].min}<br>Max: ${data[keys[i]].max}`);
                return;
            }
        }

        setTooltipHTML("");
    }

    function handleMouseLeave() {
        setTooltipHTML("");
    }

    onMount(() => drawViolinPlots());
</script>

<canvas
    bind:this={canvas}
    onmousemove={handleMouseMove}
    onmouseleave={handleMouseLeave}
></canvas>