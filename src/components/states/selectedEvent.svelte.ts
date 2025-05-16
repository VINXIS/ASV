import { eventTypes, getStrains, type Event } from "./strains.svelte";

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
    for (const strain of getStrains()) {
        for (const eventType of eventTypes)
            selectedEvent.geneEvents.push(...strain[eventType].filter(e => e.geneID === event.event.geneID || e.geneName === event.event.geneName).map((e => ({
                strain: {
                    name: strain.name,
                    colour: strain.colour,
                },
                event: e,
            }))));
    }
    updatedSelectedEvent.dispatchEvent(new Event("update"));
}
