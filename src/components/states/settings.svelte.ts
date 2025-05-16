import { updateSelectFilteredStrains, type EventType, type ReadType } from "./strains.svelte";

export const settings = $state<{
    selectedChr: string;
    selectedEvent: EventType;
    selectedJunctionView: ReadType;

    readCountThresh: number;
    FDRThresh: number;
    psiDiffThresh: number;
    extraneousPsiLimits: boolean;
}>({
    selectedChr: "All",
    selectedEvent: "A3SS",
    selectedJunctionView: "JCEC",

    readCountThresh: 10,
    FDRThresh: 0.05,
    psiDiffThresh: 0.2,
    extraneousPsiLimits: false,
});
export function resetSettings() {
    settings.selectedChr = "All";
    settings.selectedEvent = "A3SS";
    settings.selectedJunctionView = "JCEC";

    settings.readCountThresh = 10;
    settings.FDRThresh = 0.05;
    settings.psiDiffThresh = 0.2;
    settings.extraneousPsiLimits = false;

    updateSelectFilteredStrains();
}