import {type EventType } from "./strains";

export const settings: {
    selectedSpecies: string;
    selectedChr: string;
    selectedEventType: "All" | EventType;

    readCountThresh: number;
    FDRThresh: number;
    psiDiffThresh: number;
    extraneousPsiLimits: boolean;
} = {
    selectedSpecies: "human",
    selectedChr: "All",
    selectedEventType: "All",

    readCountThresh: 10,
    FDRThresh: 0.05,
    psiDiffThresh: 0.2,
    extraneousPsiLimits: false,
};