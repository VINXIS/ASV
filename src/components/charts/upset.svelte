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

        // @ts-ignore
        sets.sort((a, b) => b.elems.length - a.elems.length);
        // @ts-ignore
        combinations.sort((a, b) => a.elems.length - b.elems.length);
        
        // Get colors from CSS custom properties
        const backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--background-colour-secondary').trim() || '#f0f0f0';
        const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-color').trim() || '#1e1e1e';
        const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim() || '#2563eb';
        
        // Determine theme based on background color brightness
        const isDark = backgroundColor.includes('#') && parseInt(backgroundColor.slice(1), 16) < 0x808080;
        
        renderUpSet(div, {
            sets,
            combinations,
            width,
            height,
            theme: isDark ? "dark" : "light",
            alternatingBackgroundColor: backgroundColor,
            hoverHintColor: textColor,
            fontSizes: {
                axisTick: "12px",
                barLabel: "12px",
            },
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
></div>

<style>
    .upset {
        display: flex;
        flex-direction: column-reverse;
    }
</style>