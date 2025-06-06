import { eventID } from "../eventHelpers";
import { settings } from "./settings";

export const eventTypes = [
    "A3SS",
    "A5SS",
    "MXE",
    "RI",
    "SE",
] as const;
export const eventColours: Record<EventType, string> = {
    A3SS: "#f28e2c",
    A5SS: "#76b7b2",
    MXE: "#edc949",
    RI: "#ff9da7",
    SE: "#bab0ab",
} as const;

export type EventType = typeof eventTypes[number];

export interface Event {
    ID: number;
    geneID: string;
    geneName: string;
    chr: string;
    strand: "+" | "-";

    textWidth: number;
    
    incCount1: number[];
    skipCount1: number[];
    incCount2: number[];
    skipCount2: number[];

    incCount1Avg: number;
    skipCount1Avg: number;
    incCount2Avg: number;
    skipCount2Avg: number;
    
    incFormLen: number;
    skipFormLen: number;
    
    pVal: number;
    FDR: number;
    negLogFDR: number;
    
    psi1: number[];
    psi2: number[];
    psi1Avg: number;
    psi2Avg: number;
    psiDiff: number;

    eventType: EventType;
}

export interface ASSEvent extends Event {
    eventType: "A3SS" | "A5SS";
    
    longExonStart: number;
    longExonEnd: number;
    
    shortExonStart: number;
    shortExonEnd: number;
    
    flankingExonStart: number;
    flankingExonEnd: number;

    acrossShortBoundaryCount: number[];
    longToFlankingCount: number[];
    exclusiveToLongCount: number[];
    shortToFlankingCount: number[];
}

export interface MXEEvent extends Event {
    eventType: "MXE";
    
    exon1Start: number;
    exon1End: number;
    exon2Start: number;
    exon2End: number;

    upstreamExonStart: number;
    upstreamExonEnd: number;
    downstreamExonStart: number;
    downstreamExonEnd: number;

    upstreamToFirstCount: number[];
    firstToDownstreamCount: number[];
    upstreamToSecondCount: number[];
    secondToDownstreamCount: number[];

    firstCount: number[];
    secondCount: number[];
}

export interface RIEvent extends Event {
    eventType: "RI";
    
    riExonStart: number;
    riExonEnd: number;

    upstreamExonStart: number;
    upstreamExonEnd: number;
    downstreamExonStart: number;
    downstreamExonEnd: number;

    upstreamToIntronCount: number[];
    intronToDownstreamCount: number[];
    upstreamToDownstreamCount: number[];

    intronCount: number[];
}

export interface SEEvent extends Event {
    eventType: "SE";
    
    exonStart: number;
    exonEnd: number;

    upstreamExonStart: number;
    upstreamExonEnd: number;
    downstreamExonStart: number;
    downstreamExonEnd: number;

    upstreamToTargetCount: number[];
    targetToDownstreamCount: number[];
    upstreamToDownstreamCount: number[];

    targetCount: number[];
}

export interface Strain {
    name: string;
    colour: string;
    visible: boolean;

    A3SS: ASSEvent[];
    A5SS: ASSEvent[];
    MXE: MXEEvent[];
    RI: RIEvent[];
    SE: SEEvent[];
}

export interface BasicStrainInfo {
    name: string;
    colour: string;
    visible: boolean;
    A3SS: number;
    A5SS: number;
    MXE: number;
    RI: number;
    SE: number;
}

export const strainEventEmitter = new EventTarget();

let strains: Strain[] = [];
export function getStrains() {
    return strains;
}
export function resetStrains() {
    strains = [];
    updateSelectFilteredStrains();
}
export function getStrainLength() {
    return strains.length;
}
export function getBasicStrainInfo(): BasicStrainInfo[] {
    return strains.map(strain => ({
        name: strain.name,
        colour: strain.colour,
        visible: strain.visible,

        A3SS: strain.A3SS.length,
        A5SS: strain.A5SS.length,
        MXE: strain.MXE.length,
        RI: strain.RI.length,
        SE: strain.SE.length,
    }));
}
export function getStrainEvents(strainName: string): Event[] {
    const strain = strains.find(s => s.name === strainName);
    if (!strain) {
        console.warn(`Strain with name "${strainName}" not found.`);
        return [];
    }
    const targetEventTypes = settings.selectedEventType === "All" ? eventTypes : [settings.selectedEventType];
    const targetChr = settings.selectedChr === "All" ? null : settings.selectedChr;
    return targetEventTypes.flatMap(eventType => strain[eventType] as Event[]).filter(event => {
        const chromosomeCheck = !targetChr || (event.chr && event.chr.startsWith(targetChr));
        const limitCheck = !settings.extraneousPsiLimits || (event.psi1Avg >= 0.05 && event.psi1Avg <= 0.95);
        return chromosomeCheck && limitCheck;
    });
}
export function setStrains(newStrains: Strain[]) {
    strains = newStrains;
    updateSelectFilteredStrains();
}
export function toggleStrainVisibility(i: number) {
    strains[i].visible = !strains[i].visible;
    updateSelectFilteredStrains();
}
export function getChromosomeList() {
    const chromosomes = new Set<string>();
    chromosomes.add("All");
    Object.values(strains).forEach(strain => {
        strain.A3SS.forEach(event => chromosomes.add(/^([^_]+)/.exec(event.chr)![1].trim()));
        strain.A5SS.forEach(event => chromosomes.add(/^([^_]+)/.exec(event.chr)![1].trim()));
        strain.MXE.forEach(event => chromosomes.add(/^([^_]+)/.exec(event.chr)![1].trim()));
        strain.RI.forEach(event => chromosomes.add(/^([^_]+)/.exec(event.chr)![1].trim()));
        strain.SE.forEach(event => chromosomes.add(/^([^_]+)/.exec(event.chr)![1].trim()));
    });
    return Array.from(chromosomes).sort((a, b) => {
        const aNum = parseInt(a.replace('chr', ''));
        const bNum = parseInt(b.replace('chr', ''));
        if (!isNaN(aNum) && !isNaN(bNum))
            return aNum - bNum;
        
        return a.localeCompare(b);
    });
}

/// GENE MAPPING ///
// For each gene, get the array of strains that have events for it.
let geneMapping: { name: string; sets: string[] }[] = [];
let eventMapping: { name: string; sets: string[] }[] = [];
export function getGeneMapping() {
    return geneMapping;
}
export function getEventMapping() {
    return eventMapping;
}

/// FILTERS ///

// The filters for select inputs and otherwise are separated to optimize performance on the other inputs.
// Two objects are also necessary in order to avoid the loss of strain data when restrictions are increased with non-select inputs

let selectFilteredStrains: Record<string, { colour: string; events: Event[] }> = {};
let filteredStrains: Record<string, { colour: string; events: Event[] }> = {};
export function updateSelectFilteredStrains() {
    selectFilteredStrains = {};
    for (const strain of strains.filter(s => s.visible)) {
        selectFilteredStrains[strain.name] = { colour: strain.colour, events: [] };
        const targetEventTypes = settings.selectedEventType === "All" ? eventTypes : [settings.selectedEventType];
        for (const eventType of targetEventTypes) {
            for (const event of strain[eventType]) {
                const chromosomeCheck = settings.selectedChr === "All" || (event.chr && event.chr.startsWith(settings.selectedChr));
                const limitCheck = settings.extraneousPsiLimits === false || event.psi1Avg >= 0.05 && event.psi1Avg <= 0.95;
                if (chromosomeCheck && limitCheck)
                    selectFilteredStrains[strain.name].events.push(event);
                
            }
        }
    };
    updateFilteredStrains()
}
export function updateFilteredStrains() {
    filteredStrains = {};
    const geneObj: Record<string, string[]> = {};
    const eventObj: Record<string, string[]> = {};
    for (const [strainName, strainData] of Object.entries(selectFilteredStrains)) {
        filteredStrains[strainName] = { colour: strainData.colour, events: [] };
        for (const event of strainData.events) {
            const readCountCheck = event.incCount1Avg >= settings.readCountThresh && event.incCount2Avg >= settings.readCountThresh && event.skipCount1Avg >= settings.readCountThresh && event.skipCount2Avg >= settings.readCountThresh;
            const FDRCheck = event.FDR <= settings.FDRThresh;
            const psiDiffCheck = Math.abs(event.psiDiff) >= settings.psiDiffThresh;
            if (readCountCheck && FDRCheck && psiDiffCheck) {
                filteredStrains[strainName].events.push(event);
                const eventIDStr = eventID(event);
                if (!eventObj[eventIDStr])
                    eventObj[eventIDStr] = [];
                if (!eventObj[eventIDStr].includes(strainName))
                    eventObj[eventIDStr].push(strainName);
                if (!geneObj[event.geneID])
                    geneObj[event.geneID] = [];
                if (!geneObj[event.geneID].includes(strainName))
                    geneObj[event.geneID].push(strainName);
            }
        }
    }
    geneMapping = Object.entries(geneObj).map(([name, sets]) => ({ name, sets }));
    eventMapping = Object.entries(eventObj).map(([name, sets]) => ({ name, sets }));
    strainEventEmitter.dispatchEvent(new Event("updateFilteredStrains"));
};
export function getFilteredStrains() {
    return Object.entries(filteredStrains);
}