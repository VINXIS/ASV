<script lang="ts">
    import { colourScale, highlightColour } from "../../../utils/colour";
    import { updatedSelectedEvent } from "../states/selectedEvent.svelte";
    import { clearTooltip, setTooltipHTML } from "../states/tooltip.svelte";
    import { eventColours, type EventType } from "../states/strains.svelte";

    let canvas: HTMLCanvasElement | null = $state(null);

    let { data }: { data: Record<string, number> } = $props();
    let segments: { key: string; value: number; colour: string; startAngle: number; endAngle: number }[] = $state([]);
    const total = $derived(Object.values(data).reduce((acc, val) => acc + val, 0));
    const margin = 5; // Margin between canvas edge and pie chart, 0 because I want it to fill the entire canvas for now

    function drawSlice(
        ctx: CanvasRenderingContext2D,
        centerX: number,
        centerY: number,
        radius: number,
        startAngle: number,
        endAngle: number,
        colour: string,
    ) {
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = colour;
        ctx.fill();
        ctx.strokeStyle = "black";
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    function drawLabel(
        ctx: CanvasRenderingContext2D,
        centerX: number,
        centerY: number,
        radius: number,
        startAngle: number,
        endAngle: number,
        key: string,
        value: number
    ) {
        const segmentAngle = endAngle - startAngle;
        // Arbitrary cutoff for segment size to not write labels on very small segments
        if (segmentAngle < 0.15) return;
        
        // Positioning the text at 1/2 distance from center to edge at the middle of the segment
        const textRadius = radius * 0.5;
        const midAngle = startAngle + segmentAngle / 2;
        const textX = centerX + Math.cos(midAngle) * textRadius;
        const textY = centerY + Math.sin(midAngle) * textRadius;
        
        const text = `${key}: ${value}`;
        const percentText = `${((value / total) * 100).toFixed(0)}%`;
        
        ctx.fillStyle = "black";
        ctx.font = "bold 12px Inconsolata";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        
        // Measure text to see if it will fit
        const textWidth = ctx.measureText(text).width;
        const chordLength = 2 * radius * Math.sin(segmentAngle / 4);
        
        // Only draw if there's enough space
        if (textWidth < chordLength * 0.8) {
            ctx.fillText(text, textX, textY - 8);

            // Draws percentage below the main text
            ctx.font = "11px Inconsolata";
            ctx.fillText(percentText, textX, textY + 8);
        }
    }

    function draw() {
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        
        const width = canvas.width;
        const height = canvas.height;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) / 2 - margin;

        ctx.clearRect(0, 0, width, height);

        let startAngle = 0;
        segments = [];

        let i = 0;
        for (const [key, value] of Object.entries(data)) {
            const segmentAngle = (value / total) * Math.PI * 2;
            const endAngle = startAngle + segmentAngle;
            let colour = eventColours[key as EventType] || colourScale[i % colourScale.length];

            drawSlice(ctx, centerX, centerY, radius, startAngle, endAngle, colour);
            segments.push({ key, value, colour, startAngle, endAngle });
            
            startAngle = endAngle;
            i++;
        }
        
        // Draw labels in a separate pass to ensure they're on top
        for (const segment of segments)
            drawLabel(
                ctx,
                centerX,
                centerY,
                radius,
                segment.startAngle,
                segment.endAngle,
                segment.key,
                segment.value
            );
    }

    function handleMouseMove(event: MouseEvent) {
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) / 2 - margin;
        const distanceFromCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        if (distanceFromCenter > radius) {
            draw();
            clearTooltip();
            canvas.style.cursor = "default";
            return;
        }

        // Angle calculation (evil)
        let angleFromCenter = Math.atan2(centerY - y, x - centerX);
        if (angleFromCenter < 0)
            angleFromCenter += Math.PI * 2;
        angleFromCenter = Math.PI * 2 - angleFromCenter;

        let found = null;
        for (const segment of segments) {
            if (angleFromCenter >= segment.startAngle && angleFromCenter <= segment.endAngle) {
                found = segment;
                drawSlice(ctx, centerX, centerY, radius, segment.startAngle, segment.endAngle, highlightColour(segment.colour, 30));
            } else {
                drawSlice(ctx, centerX, centerY, radius, segment.startAngle, segment.endAngle, segment.colour);
            }
        }
        
        // Have to redraw all the labels to keep them on top
        for (const segment of segments)
            drawLabel(
                ctx,
                centerX,
                centerY,
                radius,
                segment.startAngle,
                segment.endAngle,
                segment.key,
                segment.value
            );

        if (found) {
            setTooltipHTML(
                `<div style="color: ${found.colour};"><strong>${found.key}</strong>: ${found.value} (${((found.value / total) * 100).toFixed(2)}%)</div>`,
            );
            canvas.style.cursor = "pointer";
        } else
            canvas.style.cursor = "default";
    }

    function handleMouseLeave() {
        if (!canvas) return;
        draw();
        clearTooltip();
        canvas.style.cursor = "default";
    }
    
    $effect(() => draw());
    updatedSelectedEvent.addEventListener("update", () => draw());
</script>

<canvas
    bind:this={canvas}
    onmousemove={handleMouseMove}
    onmouseleave={handleMouseLeave}
></canvas>