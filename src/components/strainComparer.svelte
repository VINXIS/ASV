<script lang="ts">
    import PieChart from "./charts/pie.svelte";
    import ViolinPlot from "./charts/violin.svelte";
    import { getStrains } from "./states/strains.svelte";
    import { getViolinValues } from "./states/violin.svelte";
</script>

<div class="strain-comparer">
    {#each getStrains() as strain, i}
        {#if strain.visible}
            <div>
                <h3>Strain {i + 1}: {strain.name}</h3>
                <PieChart
                    data={{
                        "A3SS": strain.A3SS.length,
                        "A5SS": strain.A5SS.length,
                        "MXE": strain.MXE.length,
                        "RI": strain.RI.length,
                        "SE": strain.SE.length,
                    }}
                ></PieChart>
                <ViolinPlot
                    data={{
                        psi1: getViolinValues(`${strain.name}_psi1`),
                        psi2: getViolinValues(`${strain.name}_psi2`),
                    }}
                ></ViolinPlot>
            </div>
        {/if}
    {/each}
</div>

<style>
    .strain-comparer {
        display: flex;
        gap: 20px;
    }

    .strain-comparer > div {
        border: 1px solid var(--border-colour);
        padding: 10px;
        border-radius: 5px;
        background-color: var(--background-colour);
    }

    h3 {
        margin: 0 0 10px 0;
    }
</style>