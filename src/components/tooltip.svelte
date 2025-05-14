<script lang="ts">
    import { getTooltipHTML } from "./states/tooltip.svelte";

    let tooltip: HTMLDivElement | null = $state(null);
    const display: "none" | "block" = $derived.by(() => {
        if (!tooltip) return "none";
        
        const html = getTooltipHTML();
        return html ? "block" : "none";
    });

    // Listen to mouse events in the webpage and update the tooltip position
    document.addEventListener("mousemove", (event) => {
        if (!tooltip) return;
        tooltip.style.left = `${event.clientX + 10}px`;
        tooltip.style.top = `${event.clientY + 10}px`;
    });
</script>

<div
    class="tooltip"
    style="display: {display};"
    bind:this={tooltip}
>
    {@html getTooltipHTML()}
</div>

<style>
.tooltip {
    position: fixed;
    padding: 10px;
    background: var(--background-colour);
    border-radius: 4px;
    pointer-events: none;
    font-size: 12px;
    z-index: 1000;
    box-shadow: 0 0 10px rgba(0,0,0,0.1);
    display: none;
    max-width: 300px;
}
</style>