import { getFilteredStrains, type Event } from "./strains.svelte";

let selectedEvent: {
    event: Event;
    strain: {
        name: string;
        colour: string;
    };
    geneEvents: {
        strain: {
            name: string;
            colour: string;
        };
        event: Event;
    }[];
} | null = $state(null);
export const updatedSelectedEvent = new EventTarget();
export function getSelectedEvent() {
    return selectedEvent;
}
export function setSelectedEvent(event: {
    event: Event;
    strain: {
        name: string;
        colour: string;
    };
} | null) {
    if (!event) {
        selectedEvent = null;
        updatedSelectedEvent.dispatchEvent(new Event("update"));
        return;
    }

    selectedEvent = {
        event: event.event,
        strain: event.strain,
        geneEvents: [],
    };
    for (const [strainName, strainData] of getFilteredStrains()) {
        const geneEvents = strainData.events.filter(e => e.geneID === event.event.geneID || e.geneName === event.event.geneName);
        if (geneEvents.length > 0) {
            selectedEvent.geneEvents.push(...geneEvents.map(e => ({
                strain: {
                    name: strainName,
                    colour: strainData.colour,
                },
                event: e,
            })));
        }
    }
    updatedSelectedEvent.dispatchEvent(new Event("update"));
}
