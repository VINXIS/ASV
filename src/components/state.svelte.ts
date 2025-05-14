export const eventTypes = [
    "A3SS",
    "A5SS",
    "MXE",
    "RI",
    "SE",
] as const;

export type ReadType = "JC" | "JCEC";
export type EventType = typeof eventTypes[number];

export interface Event {
    ID: number;
    geneID: string;
    geneName: string;
    chr: string;
    readType: ReadType;
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

let strains = $state<Strain[]>([]);
export function resetStrains() {
    strains = [];
    updateSelectFilteredStrains();
}
export function getStrains() {
    return strains;
}
export function setStrains(newStrains: Strain[]) {
    strains = newStrains;
    updateSelectFilteredStrains();
}
export function toggleStrainVisibility(i: number) {
    strains[i].visible = !strains[i].visible;
    updateSelectFilteredStrains();
}
export function shuffleColours() {
    strains.forEach(strain => {
        const randomColor = "#" + Math.floor(Math.random() * 16777215).toString(16);
        strain.colour = randomColor;
    });
    updateSelectFilteredStrains();
}

export const settings = $state<{
    selectedChr: string;
    selectedEvent: "All" | EventType;
    selectedJunctionView: ReadType;

    readCountThresh: number;
    FDRThresh: number;
    psiDiffThresh: number;
    extraneousPsiLimits: boolean;
}>({
    selectedChr: "All",
    selectedEvent: "All",
    selectedJunctionView: "JCEC",

    readCountThresh: 10,
    FDRThresh: 0.05,
    psiDiffThresh: 0.2,
    extraneousPsiLimits: false,
});
export function resetSettings() {
    settings.selectedChr = "All";
    settings.selectedEvent = "All";
    settings.selectedJunctionView = "JCEC";

    settings.readCountThresh = 10;
    settings.FDRThresh = 0.05;
    settings.psiDiffThresh = 0.2;
    settings.extraneousPsiLimits = false;

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

/// FILTERS ///

let selectFilteredStrains: Record<string, { colour: string; events: Event[] }> = {};
let filteredStrains: Record<string, { colour: string; events: Event[] }> = {};
export const updatedFilteredStrains = new EventTarget();
export function updateSelectFilteredStrains() {
    selectFilteredStrains = {};
    for (const strain of strains.filter(s => s.visible)) {
        selectFilteredStrains[strain.name] = { colour: strain.colour, events: [] };
        const typesToProcess = settings.selectedEvent === "All" ? eventTypes : [settings.selectedEvent];
        for (const eventType of typesToProcess) {
            selectFilteredStrains[strain.name].events.push(...strain[eventType].filter((event) => {
                const readTypeCheck = settings.selectedJunctionView === event.readType;
                const chromosomeCheck = settings.selectedChr === "All" || (event.chr && event.chr.startsWith(settings.selectedChr));
                const limitCheck = settings.extraneousPsiLimits === false || event.psi1Avg >= 0.05 && event.psi1Avg <= 0.95;
                return readTypeCheck && chromosomeCheck && limitCheck;
            }));
        }
    };
    updateFilteredStrains()
}
export function updateFilteredStrains() {
    filteredStrains = {};
    for (const [strainName, strainData] of Object.entries(selectFilteredStrains)) {
        filteredStrains[strainName] = { colour: strainData.colour, events: [] };
        for (const event of strainData.events) {
            const readCountCheck = event.incCount1Avg >= settings.readCountThresh;
            const FDRCheck = event.FDR <= settings.FDRThresh;
            const psiDiffCheck = Math.abs(event.psiDiff) >= settings.psiDiffThresh;
            if (readCountCheck && FDRCheck && psiDiffCheck)
                filteredStrains[strainName].events.push(event);
        }
    }
    updatedFilteredStrains.dispatchEvent(new Event("update"));
};
export function getFilteredStrains() {
    return Object.entries(filteredStrains);
}

/// SELECTED EVENT ///
let selectedEvent: {
    event: Event;
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
export function setSelectedEvent(event: Event | null) {
    console.log(event);
    if (!event) {
        selectedEvent = null;
        updatedSelectedEvent.dispatchEvent(new Event("update"));
        return;
    }

    selectedEvent = {
        event,
        geneEvents: [],
    };
    for (const [strainName, strainData] of Object.entries(filteredStrains)) {
        const similarEvent = strainData.events.find(e => e.geneID === event.geneID || e.geneName === event.geneName);
        if (similarEvent) {
            selectedEvent.geneEvents.push({
                strain: {
                    name: strainName,
                    colour: strainData.colour,
                },
                event: similarEvent,
            });
        }
    }
    updatedSelectedEvent.dispatchEvent(new Event("update"));
}