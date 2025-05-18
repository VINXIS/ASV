<script lang="ts">
    import PieChart from "./charts/pie.svelte";
    import ViolinPlot from "./charts/violin.svelte";
    import { getBasicStrainInfo, getFilteredStrains, strainEventEmitter, type BasicStrainInfo } from "./states/strains";

    let strains: BasicStrainInfo[] = [];
    let strainViolinData: Record<string, number[]> = {};
    let strainPieData: Record<string, { A3SS: number; A5SS: number; MXE: number; RI: number; SE: number }> = {};
    strainEventEmitter.addEventListener("updateFilteredStrains", () => {
        strains = getBasicStrainInfo();
        const filteredStrains = getFilteredStrains();
        strainViolinData = {};
        filteredStrains.forEach(([strainName, { events }]) => {
            strainPieData[strainName] = {
                A3SS: events.filter(event => event.eventType === "A3SS").length,
                A5SS: events.filter(event => event.eventType === "A5SS").length,
                MXE: events.filter(event => event.eventType === "MXE").length,
                RI: events.filter(event => event.eventType === "RI").length,
                SE: events.filter(event => event.eventType === "SE").length,
            };
            strainViolinData[`${strainName}_psi1`] = events.map(event => event.psi1Avg);
            strainViolinData[`${strainName}_psi2`] = events.map(event => event.psi2Avg);
        });
    });
</script>

<div class="strain-comparer">
    {#each strains as strain, i}
        {#if strain.visible}
            <div>
                <h3>Strain {i + 1}: {strain.name}</h3>
                <ViolinPlot
                    keys={["Ψ1", "Ψ2"]}
                    data={[strainViolinData[`${strain.name}_psi1`], strainViolinData[`${strain.name}_psi2`]]}
                    updateOnFilter
                ></ViolinPlot>
                <PieChart
                    data={strainPieData[strain.name]}
                    updateOnFilter
                ></PieChart>
            </div>
        {/if}
    {/each}
</div>

<style>
    .strain-comparer {
        display: flex;
        gap: 20px;
        justify-content: space-between;
    }

    .strain-comparer > div {
        width: calc(33.33% - 20px);
        display: flex;
        flex-direction: column;
        border: 1px solid var(--border-colour);
        padding: 10px;
        border-radius: 5px;
        background-color: var(--background-colour);
    }

    h3 {
        margin: 0 0 10px 0;
    }
</style>