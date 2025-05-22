<script lang="ts">
    import PieChart from "./charts/pie.svelte";
    import UpsetChart from "./charts/upset.svelte";
    import ViolinChart from "./charts/violin.svelte";
    import VolcanoChart from "./charts/volcano.svelte";
    import { getBasicStrainInfo, getEventMapping, getFilteredStrains, getGeneMapping, getStrainEvents, strainEventEmitter, type BasicStrainInfo, type Event } from "./states/strains";

    let strains: BasicStrainInfo[] = [];
    let strainViolinData: Record<string, number[]> = {};
    let strainPieData: Record<string, { A3SS: number; A5SS: number; MXE: number; RI: number; SE: number }> = {};
    let strainVolcanoData: Record<string, Event[]> = {};
    let geneMapping: { name: string; sets: string[] }[] = [];
    let eventMapping: { name: string; sets: string[] }[] = [];
    strainEventEmitter.addEventListener("updateFilteredStrains", () => {
        strains = getBasicStrainInfo();
        geneMapping = getGeneMapping();
        eventMapping = getEventMapping();
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
            strainViolinData[`${strainName}_psi1`] = events.flatMap(event => event.psi1);
            strainViolinData[`${strainName}_psi2`] = events.flatMap(event => event.psi2);
            strainVolcanoData[strainName] = getStrainEvents(strainName);
        });
    });
</script>

<div class="strain-comparer">
    {#each strains as strain, i}
        {#if strain.visible}
            <div>
                <h3>Strain {i + 1}: {strain.name} ({strainPieData[strain.name] ? strainPieData[strain.name].A3SS + strainPieData[strain.name].A5SS + strainPieData[strain.name].MXE + strainPieData[strain.name].RI + strainPieData[strain.name].SE : 0} events)</h3>
                <ViolinChart
                    keys={["Ψ1", "Ψ2"]}
                    data={[strainViolinData[`${strain.name}_psi1`], strainViolinData[`${strain.name}_psi2`]]}
                    updateOnFilter="strain"
                ></ViolinChart>
                <PieChart
                    data={strainPieData[strain.name]}
                ></PieChart>
                <VolcanoChart
                    data={strainVolcanoData[strain.name]}
                    strain={{ name: strain.name, colour: strain.colour }}
                    updateOnFilter="strain"
                ></VolcanoChart>
            </div>
        {/if}
    {/each}
    {#if geneMapping.length > 0}
        <h3>Upset Chart of Shared Genes With Events between Strains</h3>
        <UpsetChart
            elems={geneMapping}
            updateOnFilter
        ></UpsetChart>
    {/if}
    {#if eventMapping.length > 0}
        <h3>Upset Chart of Shared Events between Strains</h3>
        <UpsetChart
            elems={eventMapping}
            updateOnFilter
        ></UpsetChart>
    {/if}
</div>

<style>
    .strain-comparer {
        display: flex;
        gap: 20px;
        flex-wrap: wrap;
    }

    .strain-comparer > div {
        width: calc(33.33% - 40px);
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