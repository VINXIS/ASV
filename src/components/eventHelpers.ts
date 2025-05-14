import type { ASSEvent, Event, MXEEvent, RIEvent, SEEvent } from "./states/strains.svelte";

export function getPositionsFromData(data: Event) {
    let startPos = Infinity;
    let endPos = -Infinity;
    
    switch (data.eventType) {
        case "SE":
            const seData = data as SEEvent;
            startPos = Math.min(seData.exonStart, seData.upstreamExonStart, seData.downstreamExonStart);
            endPos = Math.max(seData.exonEnd, seData.upstreamExonEnd, seData.downstreamExonEnd);
            break;
            
        case "MXE":
            const mxeData = data as MXEEvent;
            startPos = Math.min(mxeData.exon1Start, mxeData.exon2Start, mxeData.upstreamExonStart, mxeData.downstreamExonStart);
            endPos = Math.max(mxeData.exon1End, mxeData.exon2End, mxeData.upstreamExonEnd, mxeData.downstreamExonEnd);
            break;
            
        case "A3SS":
        case "A5SS":
            const ass5Data = data as ASSEvent;
            startPos = Math.min(ass5Data.longExonStart, ass5Data.shortExonStart, ass5Data.flankingExonStart);
            endPos = Math.max(ass5Data.longExonEnd, ass5Data.shortExonEnd, ass5Data.flankingExonEnd);
            break;
            
        case "RI":
            const riData = data as RIEvent;
            startPos = Math.min(riData.riExonStart, riData.upstreamExonStart, riData.downstreamExonStart);
            endPos = Math.max(riData.riExonEnd, riData.upstreamExonEnd, riData.downstreamExonEnd);
            break;
    }
    
    return { start: startPos, end: endPos };
}

export function getSplicingExons(data: Event): {
    start: number;
    end: number;
    type: "junction" | "upstream" | "downstream" | "first" | "second" | "flanking" | "long" | "short" | "intron" | "target";
    inclusion: boolean;
}[] {
    const strand = data.strand;
    let exons: {
        start: number;
        end: number;
        // "junction" is used for the junctions between exons
        // "upstream" and "downstream" are used for the exons that are not part of the event
        // "first" and "second" are used for the exons that are part of the event
        // "flanking" is used for the exons that are not part of the event but are adjacent to the event
        // "long" and "short" are used for the exons that are part of the event
        // "intron" is used for the intron that is part of the event
        // "target" is used for the exon that is the target of the event
        // These are dependent on the event type and strand
        type: "junction" | "upstream" | "downstream" | "first" | "second" | "flanking" | "long" | "short" | "intron" | "target";
        inclusion: boolean;
    }[] = [];
    
    switch (data.eventType) {
        case "SE":
            const seData = data as SEEvent;
            if (strand === "+") {
                exons = [
                    { start: seData.upstreamExonStart, end: seData.upstreamExonEnd, type: "upstream", inclusion: true },
                    { start: seData.exonStart, end: seData.exonEnd, type: "target", inclusion: true },
                    { start: seData.downstreamExonStart, end: seData.downstreamExonEnd, type: "downstream", inclusion: true }
                ];
                exons.push({
                    start: seData.upstreamExonEnd,
                    end: seData.downstreamExonStart,
                    type: "junction",
                    inclusion: false,
                    
                });
            } else {
                exons = [
                    { start: seData.downstreamExonStart, end: seData.downstreamExonEnd, type: "downstream", inclusion: true },
                    { start: seData.exonStart, end: seData.exonEnd, type: "target", inclusion: true },
                    { start: seData.upstreamExonStart, end: seData.upstreamExonEnd, type: "upstream", inclusion: true }
                ];
                exons.push({
                    start: seData.downstreamExonEnd,
                    end: seData.upstreamExonStart,
                    type: "junction", 
                    inclusion: false,
                });
            }
            break;
            
        case "MXE":
            const mxeData = data as MXEEvent;
            if (strand === "+") {
                // On + strand, first exon is the inclusion form
                // Second exon is the exclusion form
                exons = [
                    { start: mxeData.upstreamExonStart, end: mxeData.upstreamExonEnd, type: "upstream", inclusion: true },
                    { start: mxeData.exon1Start, end: mxeData.exon1End, type: "first", inclusion: true },
                    { start: mxeData.exon2Start, end: mxeData.exon2End, type: "second", inclusion: false },
                    { start: mxeData.downstreamExonStart, end: mxeData.downstreamExonEnd, type: "downstream", inclusion: true }
                ];
                exons.push({
                    start: mxeData.upstreamExonEnd,
                    end: mxeData.exon1Start,
                    type: "junction",
                    inclusion: true,
                });
                exons.push({
                    start: mxeData.exon1End,
                    end: mxeData.downstreamExonStart,
                    type: "junction",
                    inclusion: true
                });
                exons.push({
                    start: mxeData.upstreamExonEnd, 
                    end: mxeData.exon2Start,
                    type: "junction",
                    inclusion: false
                });
                exons.push({
                    start: mxeData.exon2End,
                    end: mxeData.downstreamExonStart,
                    type: "junction",
                    inclusion: false
                });
            } else {
                // On - strand, second exon is the inclusion form
                // First exon is the exclusion form
                exons = [
                    { start: mxeData.downstreamExonStart, end: mxeData.downstreamExonEnd, type: "downstream", inclusion: true },
                    { start: mxeData.exon2Start, end: mxeData.exon2End, type: "second", inclusion: true },
                    { start: mxeData.exon1Start, end: mxeData.exon1End, type: "first", inclusion: false },
                    { start: mxeData.upstreamExonStart, end: mxeData.upstreamExonEnd, type: "upstream", inclusion: true }
                ];
                exons.push({
                    start: mxeData.downstreamExonEnd,
                    end: mxeData.exon2Start,
                    type: "junction",
                    inclusion: true
                });
                exons.push({
                    start: mxeData.exon2End,
                    end: mxeData.upstreamExonStart,
                    type: "junction",
                    inclusion: true
                });
                exons.push({
                    start: mxeData.downstreamExonEnd,
                    end: mxeData.exon1Start,
                    type: "junction",
                    inclusion: false
                });
                exons.push({
                    start: mxeData.exon1End,
                    end: mxeData.upstreamExonStart,
                    type: "junction",
                    inclusion: false
                });
            }
            break;
            
        case "A3SS":
            const ass3Data = data as ASSEvent;
            if (strand === "+") {
                exons = [
                    { start: ass3Data.flankingExonStart, end: ass3Data.flankingExonEnd, type: "flanking", inclusion: true },
                    { start: ass3Data.longExonStart, end: ass3Data.longExonEnd, type: "long", inclusion: true },
                    { start: ass3Data.shortExonStart, end: ass3Data.shortExonEnd, type: "short", inclusion: false }
                ];
                exons.push({
                    start: ass3Data.flankingExonEnd,
                    end: ass3Data.shortExonStart,
                    type: "junction",
                    inclusion: false
                });
                exons.push({
                    start: ass3Data.flankingExonEnd,
                    end: ass3Data.longExonStart,
                    type: "junction",
                    inclusion: true
                });
            } else {
                exons = [
                    { start: ass3Data.longExonStart, end: ass3Data.longExonEnd, type: "long", inclusion: true },
                    { start: ass3Data.shortExonStart, end: ass3Data.shortExonEnd, type: "short", inclusion: false },
                    { start: ass3Data.flankingExonStart, end: ass3Data.flankingExonEnd, type: "flanking", inclusion: true }
                ];
                exons.push({
                    start: ass3Data.shortExonEnd,
                    end: ass3Data.flankingExonStart,
                    type: "junction",
                    inclusion: false
                });
                exons.push({
                    start: ass3Data.longExonEnd,
                    end: ass3Data.flankingExonStart,
                    type: "junction",
                    inclusion: true
                });
            }
            break;
            
        case "A5SS":
            const ass5Data = data as ASSEvent;
            if (strand === "+") {
                exons = [
                    { start: ass5Data.flankingExonStart, end: ass5Data.flankingExonEnd, type: "flanking", inclusion: true },
                    { start: ass5Data.shortExonStart, end: ass5Data.shortExonEnd, type: "short", inclusion: false },
                    { start: ass5Data.longExonStart, end: ass5Data.longExonEnd, type: "long", inclusion: true }
                ];
                exons.push({
                    start: ass5Data.flankingExonEnd,
                    end: ass5Data.shortExonStart,
                    type: "junction",
                    inclusion: false
                });
                exons.push({
                    start: ass5Data.flankingExonEnd,
                    end: ass5Data.longExonStart,
                    type: "junction",
                    inclusion: true
                });
            } else {
                exons = [
                    { start: ass5Data.longExonStart, end: ass5Data.longExonEnd, type: "long", inclusion: true },
                    { start: ass5Data.shortExonStart, end: ass5Data.shortExonEnd, type: "short", inclusion: false },
                    { start: ass5Data.flankingExonStart, end: ass5Data.flankingExonEnd, type: "flanking", inclusion: true }
                ];
                exons.push({
                    start: ass5Data.shortExonEnd,
                    end: ass5Data.flankingExonStart,
                    type: "junction",
                    inclusion: false
                });
                exons.push({
                    start: ass5Data.longExonEnd,
                    end: ass5Data.flankingExonStart,
                    type: "junction",
                    inclusion: true
                });
            }
            break;
            
        case "RI":
            const riData = data as RIEvent;
            if (strand === "+") {
                exons = [
                    { start: riData.upstreamExonStart, end: riData.upstreamExonEnd, type: "upstream", inclusion: true },
                    { start: riData.upstreamExonEnd, end: riData.downstreamExonStart, type: "intron", inclusion: true },
                    { start: riData.downstreamExonStart, end: riData.downstreamExonEnd, type: "downstream", inclusion: true }
                ];
                exons.push({
                    start: riData.upstreamExonEnd,
                    end: riData.downstreamExonStart,
                    type: "junction",
                    inclusion: false
                });
            } else {
                exons = [
                    { start: riData.downstreamExonStart, end: riData.downstreamExonEnd, type: "downstream", inclusion: true },
                    { start: riData.upstreamExonEnd, end: riData.downstreamExonStart, type: "intron", inclusion: true },
                    { start: riData.upstreamExonStart, end: riData.upstreamExonEnd, type: "upstream", inclusion: true }
                ];
                exons.push({
                    start: riData.downstreamExonEnd,
                    end: riData.upstreamExonStart,
                    type: "junction",
                    inclusion: false
                });
            }
            break;
    }
    
    // Filter out exons with invalid coordinates
    return exons.filter(exon => 
        exon.start !== undefined && 
        exon.end !== undefined && 
        isFinite(exon.start) && 
        isFinite(exon.end)
    );
}