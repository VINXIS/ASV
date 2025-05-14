<script lang="ts">
  import { onMount } from "svelte";
  import { getRandomColour, highlightColour } from "../../../utils/colour";
  import { updatedSelectedEvent } from "../states/selectedEvent.svelte";

    let canvas: HTMLCanvasElement | null = $state(null);
    let tooltip: HTMLDivElement | null = $state(null);

    let { data }: { data: Record<string, number> } = $props();
    let hoveredItem: string = $state("");
    let legendItems: { key: string; value: number; colour: string }[] = $state([]);
    const total = $derived(Object.values(data).reduce((acc, val) => acc + val, 0));

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

    function draw(changeColours = true) {
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        
        const width = canvas.width;
        const height = canvas.height;
        const centerX = width / 2;
        const centerY = height / 2;
        const margin = 10;
        const radius = Math.min(width, height) / 2 - margin;

        let currentColour = getRandomColour();
        let startAngle = 0;
        if (changeColours)
            legendItems = [];

        let i = 0;
        for (const [key, value] of Object.entries(data)) {
            const segmentAngle = (value / total) * Math.PI * 2;
            const endAngle = startAngle + segmentAngle;
            const colour = changeColours ? currentColour : legendItems[i].colour;

            drawSlice(ctx, centerX, centerY, radius, startAngle, endAngle, colour);
            if (changeColours)
                legendItems.push({ key, value, colour });

            startAngle = endAngle;
            i++;

            if (changeColours) {
                const nextColour = getRandomColour();
                while (Math.abs(parseInt(currentColour.slice(1), 16) - parseInt(nextColour.slice(1), 16)) < 0x111111) // Checking for contrast
                    currentColour = getRandomColour();
                currentColour = nextColour;
            }
        }
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
        const margin = 10;
        const radius = Math.min(width, height) / 2 - margin;
        const distanceFromCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        if (distanceFromCenter > radius) {
            draw(false);
            hoveredItem = "";
            if (tooltip)
                tooltip.style.display = "none";
            canvas.style.cursor = "default";
            return;
        }

        // Angle calculation
        let angleFromCenter = Math.atan2(centerY - y, x - centerX);
        if (angleFromCenter < 0)
            angleFromCenter += Math.PI * 2;
        angleFromCenter = Math.PI * 2 - angleFromCenter;

        let startAngle = 0;
        let found = false;
        hoveredItem = "";
        for (const item of legendItems) {
            const segmentAngle = (item.value / total) * Math.PI * 2;
            const endAngle = startAngle + segmentAngle;

            if (angleFromCenter >= startAngle && angleFromCenter <= endAngle) {
                hoveredItem = item.key;
                found = true;
                drawSlice(ctx, centerX, centerY, radius, startAngle, endAngle, highlightColour(item.colour, 30)); // Make the slice brighter
            } else
                drawSlice(ctx, centerX, centerY, radius, startAngle, endAngle, item.colour); // Draw the slice normally in case it was highlighted before
            startAngle += segmentAngle;
        }

        if (found && tooltip) {
            tooltip.style.display = "block";
            tooltip.style.left = `${event.x + 10}px`;
            tooltip.style.top = `${event.y + 10}px`;
            tooltip.innerHTML = hoveredItem;
            canvas.style.cursor = "pointer";
        } else if (tooltip) {
            tooltip.style.display = "none";
            canvas.style.cursor = "default";
        }
    }
    
    onMount(() => draw());
    updatedSelectedEvent.addEventListener("update", () => draw());
</script>

<canvas
    bind:this={canvas}
    onmousemove={handleMouseMove}
></canvas>
<div>
    {#each legendItems as item}
        <div class="legend-item">
            <div class="colour-box" style="background-colour: {item.colour};"></div>
            <span>{item.key}: {item.value}</span>
        </div>
    {/each}
</div>
<div bind:this={tooltip} class="tooltip">
    <span>{hoveredItem}</span>
</div>

<style>
    .tooltip {
        position: fixed;
        background-color: var(--background-colour);
        padding: 5px;
        border-radius: 5px;
        box-shadow: 0 0 5px rgba(0, 0, 0, 0.3);
        pointer-events: none;
        z-index: 1000;
        display: none;
    }
</style>