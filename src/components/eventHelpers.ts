import { arrayToString } from "../../utils/tables";
import { biotypeSortOrder, getGeneInfo, type Transcript } from "./states/ensembl";
import type { ASSEvent, Event, EventType, MXEEvent, RIEvent, SEEvent } from "./states/strains";

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

export function eventID(event: Event) {
    const positions = getSplicingExons(event);
    return `${event.geneName}_${event.eventType}_${event.chr}_${event.strand}_${positions.map(pos => `${pos.start}_${pos.end}`).join("_")}`;
}

export function getSplicingExons(data: Event): {
    start: number;
    end: number;
    type: "junction" | "upstream" | "downstream" | "first" | "second" | "flanking" | "long" | "short" | "target";
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
        // "target" is used for the exon that is the target of the event
        // These are dependent on the event type and strand
        type: "junction" | "upstream" | "downstream" | "first" | "second" | "flanking" | "long" | "short" | "target";
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
            } else {
                exons = [
                    { start: seData.downstreamExonStart, end: seData.downstreamExonEnd, type: "downstream", inclusion: true },
                    { start: seData.exonStart, end: seData.exonEnd, type: "target", inclusion: true },
                    { start: seData.upstreamExonStart, end: seData.upstreamExonEnd, type: "upstream", inclusion: true }
                ];
            }
            exons.push({
                start: seData.upstreamExonEnd,
                end: seData.downstreamExonStart,
                type: "junction",
                inclusion: false
                
            });
            exons.push({
                start: seData.exonEnd,
                end: seData.downstreamExonStart,
                type: "junction",
                inclusion: true
            });
            exons.push({
                start: seData.upstreamExonEnd,
                end: seData.exonStart,
                type: "junction",
                inclusion: true
            });
            break;
            
        case "MXE":
            const mxeData = data as MXEEvent;
            if (strand === "+") {
                // On + strand, first exon is the inclusion form
                // Second exon is the skipped form
                exons = [
                    { start: mxeData.upstreamExonStart, end: mxeData.upstreamExonEnd, type: "upstream", inclusion: true },
                    { start: mxeData.exon1Start, end: mxeData.exon1End, type: "first", inclusion: true },
                    { start: mxeData.exon2Start, end: mxeData.exon2End, type: "second", inclusion: false },
                    { start: mxeData.downstreamExonStart, end: mxeData.downstreamExonEnd, type: "downstream", inclusion: true }
                ];
            } else {
                // On - strand, second exon is the inclusion form
                // First exon is the skipped form
                exons = [
                    { start: mxeData.downstreamExonStart, end: mxeData.downstreamExonEnd, type: "downstream", inclusion: true },
                    { start: mxeData.exon2Start, end: mxeData.exon2End, type: "second", inclusion: true },
                    { start: mxeData.exon1Start, end: mxeData.exon1End, type: "first", inclusion: false },
                    { start: mxeData.upstreamExonStart, end: mxeData.upstreamExonEnd, type: "upstream", inclusion: true }
                ];
            }
            exons.push({
                start: mxeData.exon2End,
                end: mxeData.downstreamExonStart,
                type: "junction",
                inclusion: strand === "+" ? false : true
            });
            exons.push({
                start: mxeData.upstreamExonEnd,
                end: mxeData.exon2Start,
                type: "junction",
                inclusion: strand === "+" ? false : true
            });
            exons.push({
                start: mxeData.exon1End,
                end: mxeData.downstreamExonStart,
                type: "junction",
                inclusion: strand === "+" ? true : false
            });
            exons.push({
                start: mxeData.upstreamExonEnd,
                end: mxeData.exon1Start,
                type: "junction",
                inclusion: strand === "+" ? true : false
            });
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
            } else {
                exons = [
                    { start: ass5Data.longExonStart, end: ass5Data.longExonEnd, type: "long", inclusion: true },
                    { start: ass5Data.shortExonStart, end: ass5Data.shortExonEnd, type: "short", inclusion: false },
                    { start: ass5Data.flankingExonStart, end: ass5Data.flankingExonEnd, type: "flanking", inclusion: true }
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
            }
            break;
            
        case "RI":
            const riData = data as RIEvent;
            if (strand === "+") {
                exons = [
                    { start: riData.upstreamExonStart, end: riData.upstreamExonEnd, type: "upstream", inclusion: true },
                    { start: riData.upstreamExonEnd, end: riData.downstreamExonStart, type: "junction", inclusion: true },
                    { start: riData.downstreamExonStart, end: riData.downstreamExonEnd, type: "downstream", inclusion: true }
                ];
            } else {
                exons = [
                    { start: riData.downstreamExonStart, end: riData.downstreamExonEnd, type: "downstream", inclusion: true },
                    { start: riData.upstreamExonEnd, end: riData.downstreamExonStart, type: "junction", inclusion: true },
                    { start: riData.upstreamExonStart, end: riData.upstreamExonEnd, type: "upstream", inclusion: true }
                ];
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

export function eventTypeToCSVHeader(eventType: EventType, includeBiotype: boolean): string {
    const sharedColumns = [
        "ID",
        "Gene Name",
        "Chromosome",
        "Strand",
        "Inclusion Count 1",
        "Skipping Count 1",
        "Inclusion Count 2",
        "Skipping Count 2",
        "Inclusion Form Length",
        "Skipping Form Length",
        "p-value",
        "FDR",
        "PSI 1",
        "PSI 2",
        "PSI Difference"
    ];

    let specificColumns: string[] = [];
    switch (eventType) {
        case "SE":
            specificColumns = [
                "Exon Start",
                "Exon End",
                "Upstream Exon Start",
                "Upstream Exon End",
                "Downstream Exon Start",
                "Downstream Exon End",
                "Upstream to Target Count",
                "Target to Downstream Count",
                "Target Count",
                "Upstream to Downstream Count"
            ];
            break;
        case "MXE":
            specificColumns = [
                "Exon 1 Start",
                "Exon 1 End",
                "Exon 2 Start",
                "Exon 2 End",
                "Upstream Exon Start",
                "Upstream Exon End",
                "Downstream Exon Start",
                "Downstream Exon End",
                "Upstream to First Count",
                "First to Downstream Count",
                "First Count",
                "Upstream to Second Count",
                "Second to Downstream Count",
                "Second Count"
            ];
            break;
        case "A3SS":
        case "A5SS":
            specificColumns = [
                "Long Exon Start",
                "Long Exon End",
                "Short Exon Start",
                "Short Exon End",
                "Flanking Exon Start",
                "Flanking Exon End",
                "Across Short Boundary Count",
                "Long to Flanking Count",
                "Exclusive to Long Count",
                "Short to Flanking Count"
            ];
            break;
        case "RI":
            specificColumns = [
                "RI Exon Start",
                "RI Exon End",
                "Upstream Exon Start",
                "Upstream Exon End",
                "Downstream Exon Start",
                "Downstream Exon End",
                "Upstream to Intron Count",
                "Intron to Downstream Count",
                "Intron Count",
                "Upstream to Downstream Count"
            ];
            break;
        default:
            throw new Error(`Unknown event type: ${eventType}`);
    }
    // Combine shared and specific columns
    const allColumns = [...sharedColumns, ...specificColumns];
    if (includeBiotype)
        allColumns.push("Inclusion Best Candidate Biotype", "Skipping Best Candidate Biotype", "Inclusion Best Candidate Transcript ID", "Skipping Best Candidate Transcript ID");

    // Join all columns with tab separator
    return allColumns.join(",");
}

export async function eventToCSV(event: Event, includeBiotype: boolean): Promise<string> {
    const eventType = event.eventType;
    const geneName = event.geneName;
    const chr = event.chr;
    const strand = event.strand;
    const id = eventID(event);
    
    // Shared columns
    const sharedColumns: string[] = [
        id,
        geneName,
        chr,
        strand,
        arrayToString(event.incCount1, true),
        arrayToString(event.skipCount1, true),
        arrayToString(event.incCount2, true),
        arrayToString(event.skipCount2, true),
        event.incFormLen.toString(),
        event.skipFormLen.toString(),
        event.pVal.toString(),
        event.FDR.toString(),
        arrayToString(event.psi1, true),
        arrayToString(event.psi2, true),
        event.psiDiff.toString(),
    ];
    
    // Event specific columns
    let specificColumns: string[] = [];
    switch (eventType) {
        case "SE":
            const seData = event as SEEvent;
            specificColumns = [
                seData.exonStart.toString(),
                seData.exonEnd.toString(),
                seData.upstreamExonStart.toString(),
                seData.upstreamExonEnd.toString(),
                seData.downstreamExonStart.toString(),
                seData.downstreamExonEnd.toString(),
                arrayToString(seData.upstreamToTargetCount, true),
                arrayToString(seData.targetToDownstreamCount, true),
                arrayToString(seData.targetCount, true),
                arrayToString(seData.upstreamToDownstreamCount, true)
            ];
            break;
        case "MXE":
            const mxeData = event as MXEEvent;
            specificColumns = [
                mxeData.exon1Start.toString(),
                mxeData.exon1End.toString(),
                mxeData.exon2Start.toString(),
                mxeData.exon2End.toString(),
                mxeData.upstreamExonStart.toString(),
                mxeData.upstreamExonEnd.toString(),
                mxeData.downstreamExonStart.toString(),
                mxeData.downstreamExonEnd.toString(),
                arrayToString(mxeData.upstreamToFirstCount, true),
                arrayToString(mxeData.firstToDownstreamCount, true),
                arrayToString(mxeData.firstCount, true),
                arrayToString(mxeData.upstreamToSecondCount, true),
                arrayToString(mxeData.secondToDownstreamCount, true),
                arrayToString(mxeData.secondCount, true)
            ];
            break;
        case "A3SS":
        case "A5SS":
            const assData = event as ASSEvent;
            specificColumns = [
                assData.longExonStart.toString(),
                assData.longExonEnd.toString(),
                assData.shortExonStart.toString(),
                assData.shortExonEnd.toString(),
                assData.flankingExonStart.toString(),
                assData.flankingExonEnd.toString(),
                arrayToString(assData.acrossShortBoundaryCount, true),
                arrayToString(assData.longToFlankingCount, true),
                arrayToString(assData.exclusiveToLongCount, true),
                arrayToString(assData.shortToFlankingCount, true)
            ];
            break;
        case "RI":
            const riData = event as RIEvent;
            specificColumns = [
                riData.riExonStart.toString(),
                riData.riExonEnd.toString(),
                riData.upstreamExonStart.toString(),
                riData.upstreamExonEnd.toString(),
                riData.downstreamExonStart.toString(),
                riData.downstreamExonEnd.toString(),
                arrayToString(riData.upstreamToIntronCount, true),
                arrayToString(riData.intronToDownstreamCount, true),
                arrayToString(riData.intronCount, true),
                arrayToString(riData.upstreamToDownstreamCount, true)
            ];
            break;
        default:
            throw new Error(`Unknown event type: ${eventType}`);
    }
    
    // Combine shared and specific columns
    const allColumns: string[] = [...sharedColumns, ...specificColumns];
    
    if (includeBiotype) {
        try {
            const geneInfo = await getGeneInfo(event.geneName);

            const inclusionTranscripts: Transcript[] = [];
            const skippedTranscripts: Transcript[] = [];
            let inclusionBestCandidate: Transcript | null = null;
            let skippedBestCandidate: Transcript | null = null;

            for (const transcript of geneInfo.Transcript) {
                if (transcript.biotype === "retained_intron" && event.eventType !== "RI") continue;

                const exons = getSplicingExons(event);
                const position = getPositionsFromData(event);
                const inclusionExons = exons.filter(exon => exon.inclusion && exon.type !== "junction");
                const skippedExons = exons.filter(exon => (!exon.inclusion || exon.type === "upstream" || exon.type === "downstream" || exon.type === "flanking") && exon.type !== "junction");

                let isInclusion = event.eventType !== "RI" ? inclusionExons.every(exon => transcript.Exon.some(tExon => tExon.start === exon.start && tExon.end === exon.end)) : transcript.Exon.some(tExon => tExon.start === position.start && tExon.end === position.end);
                let isSkipped = skippedExons.every(exon => transcript.Exon.some(tExon => tExon.start === exon.start && tExon.end === exon.end));
                
                const minInclusionPos = Math.min(...inclusionExons.map(e => e.start));
                const maxInclusionPos = Math.max(...inclusionExons.map(e => e.end));
                const minSkippedPos = Math.min(...skippedExons.map(e => e.start));
                const maxSkippedPos = Math.max(...skippedExons.map(e => e.end));

                if (event.eventType !== "RI" && transcript.Exon.some(tExon => {
                    return (
                        (tExon.start >= minInclusionPos && tExon.start <= maxInclusionPos) || 
                        (tExon.end >= minInclusionPos && tExon.end <= maxInclusionPos)
                    ) && !inclusionExons.some(e => e.start === tExon.start && e.end === tExon.end); 
                }))
                    isInclusion = false;
                if (isInclusion)
                    inclusionTranscripts.push(transcript);

                if (transcript.Exon.some(tExon => {
                    return (
                        (tExon.start >= minSkippedPos && tExon.start <= maxSkippedPos) || 
                        (tExon.end >= minSkippedPos && tExon.end <= maxSkippedPos)
                    ) && !skippedExons.some(e => e.start === tExon.start && e.end === tExon.end); 
                }))
                    isSkipped = false;
                if (isSkipped)
                    skippedTranscripts.push(transcript);
            }
            
            if (inclusionTranscripts.length > 0)
                inclusionBestCandidate = inclusionTranscripts[0];
            if (skippedTranscripts.length > 0)
                skippedBestCandidate = skippedTranscripts[0];

            allColumns.push(
                inclusionBestCandidate ? inclusionBestCandidate.biotype : "N/A",
                skippedBestCandidate ? skippedBestCandidate.biotype : "N/A",
                inclusionBestCandidate ? `${inclusionBestCandidate.id}.${inclusionBestCandidate.version}` : "N/A",
                skippedBestCandidate ? `${skippedBestCandidate.id}.${skippedBestCandidate.version}` : "N/A",
            );
        } catch (error) {
            console.warn(`Failed to fetch gene info for ${event.geneName}, using default values.`);
            allColumns.push("N/A", "N/A", "N/A", "N/A");
        }
    }

    return allColumns.join(",");
}