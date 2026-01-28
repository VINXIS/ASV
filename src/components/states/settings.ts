import {type EventType } from "./strains";

export const settings: {
    selectedSpecies: string;
    selectedChr: string;
    selectedEventType: "All" | EventType;

    selectedGtfId: string;

    readCountThresh: number;
    FDRThresh: number;
    psiDiffThresh: number;
    extraneousPsiLimits: boolean;
} = {
    selectedSpecies: "homo_sapiens",
    selectedChr: "All",
    selectedEventType: "All",

    selectedGtfId: "",

    readCountThresh: 10,
    FDRThresh: 0.05,
    psiDiffThresh: 0.2,
    extraneousPsiLimits: false,
};