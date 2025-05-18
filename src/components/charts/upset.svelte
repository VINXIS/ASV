<script lang="ts">
    import { extractCombinations, renderUpSet } from '@upsetjs/bundle';
    import { onMount } from 'svelte';
    import { strainEventEmitter } from '../states/strains';
  import { rootObserver } from '../rootObserver';

    let div: HTMLDivElement | null = null;

    let { elems, updateOnFilter }: { elems: { name: string; sets: string[] }[]; updateOnFilter: boolean } = $props();
    let { sets, combinations } = extractCombinations(elems);

    let width = 780;
    let height = 400;
    let selection: any = null;

    function onHover(set: any) {
        selection = set;
        rerender();
    }

    function rerender(extract = false) {
        if (!div || elems.length === 0) return;
        if (extract)
            ({ sets, combinations } = extractCombinations(elems));
        // Check if root has light or dark mode
        let root = document.querySelector(":root")!;
        // const textColour = root.classList.contains("dark") ? "#fbfbfe" : "#1e1e1e";
        renderUpSet(div, {
            sets,
            combinations,
            width,
            height,
            theme: root.classList.contains("dark") ? "dark" : "light",
            alternatingBackgroundColor: root.classList.contains("dark") ? "#2c2c2c" : "#f0f0f0",
            hoverHintColor: root.classList.contains("dark") ? "#fbfbfe" : "#1e1e1e",
            selection,
            onHover
        });
    }

    rootObserver(rerender);
    onMount(() => {
        const resizeObserver = new ResizeObserver(() => {
            if (div) {
                width = div.clientWidth;
                height = div.clientWidth / 2;
                rerender();
            }
        });
        if (div)
            resizeObserver.observe(div);
        if (!div) return;
        rerender();
    });
    if (updateOnFilter)
        strainEventEmitter.addEventListener("updateFilteredStrains", () => rerender(true));
</script>

<div
    class="upset"
    bind:this={div}
    style="width: 100%; height: 100%;"
>
    {#if elems.length > 0}
        Upset Chart of Overlap between Genes Affected by Events Between Strains
    {/if}
</div>

<style>
    .upset {
        display: flex;
        flex-direction: column-reverse;
    }
</style>