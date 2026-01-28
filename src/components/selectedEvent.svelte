<script lang="ts">
    import { eventID, getPositionsFromData, getSplicingExons } from "./eventHelpers";
    import { rootObserver } from "./rootObserver";
    import { type SEEvent, type MXEEvent, type ASSEvent, type RIEvent, eventColours, type Event } from "./states/strains";
    import PieChart from "./charts/pie.svelte";
    import ViolinChart from "./charts/violin.svelte";
    import VolcanoChart from "./charts/volcano.svelte";
    import { getSelectedEvent, setSelectedEvent, updatedSelectedEvent, type SelectedEvent } from "./states/selectedEvent";
    import { settings } from "./states/settings";
    import { arrayToString } from "../../utils/tables";
    import { getGeneInfo, getSequenceRegion, type Exon, type SymbolLookup, type Transcript } from "./states/ensembl";
    import { getGtfGeneModel, type GtfGeneModel, type GtfTranscript } from "./states/gtf";
    import { getTooltipHTML, setTooltipHTML } from "./states/tooltip";

    let canvas: HTMLCanvasElement | null = null;
    let selectedEvent: SelectedEvent | null = null;
    let currGeneName: string | null = null;
    let geneInfo: SymbolLookup | null = null;

    let gtfGeneModel: GtfGeneModel | null = null;
    let gtfError: string | null = null;
    let currGtfKey: string | null = null;
    let gtfInclusionTranscripts: GtfTranscript[] = [];
    let gtfSkippedTranscripts: GtfTranscript[] = [];
    let gtfUnidentifiedTranscripts: GtfTranscript[] = [];

    let inclusionTranscripts: Transcript[] = [];
    let inclusionBestCandidate: Transcript | null = null;
    let inclusionBestCandidateCDS: string | null = null;
    let inclusionBestCandidateMRNA: string | null = null;

    let skippedTranscripts: Transcript[] = [];
    let skippedBestCandidate: Transcript | null = null;
    let skippedBestCandidateCDS: string | null = null;
    let skippedBestCandidateMRNA: string | null = null;

    let canonicalCDS: string | null = null;
    let canonicalMRNA: string | null = null;

    let significance: "Upregulated" | "Downregulated" | "Not Significant" | null = null;

    let useFilter = true;
    let readCountThresh = true;
    let sameEventOnly = false;
    let mouseData: { x: number; y: number } | null = null;
    let filteredEvents: {
        strain: {
            name: string;
            colour: string;
        };
        event: Event;
    }[] = [];
    let eventCounts: Record<string, number> = {};
    let loading = false;

    // Zoom variables
    let zoomLevel = 1;
    let xOffset = 0;
    let drag = false;
    let lastMouseX = 0;

    const colours = {
        inclusion: "#4285F4",
        skipped: "#DB4437",
        gtf: "#888888",
        canonical: "#F4B400",
        combined: "#0F9D58", 
    }

    function isUsingServerGtf() {
        return !!settings.selectedGtfId && !!gtfGeneModel && gtfGeneModel.transcripts.length > 0;
    }

    async function updateValues(mustDraw = true) {
        loading = true;
        selectedEvent = getSelectedEvent();
        if (!selectedEvent)
            return;
        
        inclusionTranscripts = [];
        inclusionBestCandidate = null;
        inclusionBestCandidateCDS = null;
        inclusionBestCandidateMRNA = null;

        skippedTranscripts = [];
        skippedBestCandidate = null;
        skippedBestCandidateCDS = null;
        skippedBestCandidateMRNA = null;

        canonicalCDS = null;

        gtfGeneModel = null;
        gtfError = null;
        gtfInclusionTranscripts = [];
        gtfSkippedTranscripts = [];
        gtfUnidentifiedTranscripts = [];

        significance = null;
        if (
            selectedEvent.event.incCount1Avg >= settings.readCountThresh && 
            selectedEvent.event.incCount2Avg >= settings.readCountThresh && 
            selectedEvent.event.skipCount1Avg >= settings.readCountThresh && 
            selectedEvent.event.skipCount2Avg >= settings.readCountThresh &&
            selectedEvent.event.FDR <= settings.FDRThresh
        )
            significance = selectedEvent.event.psiDiff > settings.psiDiffThresh ? "Upregulated" : selectedEvent.event.psiDiff < -settings.psiDiffThresh ? "Downregulated" : "Not Significant";
        else
            significance = "Not Significant";    

        if (currGeneName !== selectedEvent.event.geneName) {
            geneInfo = null;
            try {
                geneInfo = await getGeneInfo(selectedEvent.event.geneName, selectedEvent.event.eventType === "RI");
            } catch (e) {
                console.error("Failed to fetch gene info or RNA sequence:", e);
                geneInfo = null;
            }

            canonicalCDS = null;
            if (geneInfo) {
                const canonicalTranscript = geneInfo.Transcript.find(t => t.is_canonical);
                const translation = canonicalTranscript?.Translation;
                if (canonicalTranscript) {
                    try {
                        canonicalMRNA = "";
                        for (const exon of canonicalTranscript.Exon) {
                            canonicalMRNA += await getSequenceRegion(geneInfo!.seq_region_name, exon.start, exon.end, geneInfo!.strand);
                        }
                    } catch (e) {
                        console.error("Failed to fetch canonical mRNA sequence:", e);
                        canonicalMRNA = null;
                    }
                    if (translation) {
                        try {
                            canonicalCDS = await getSequenceRegion(geneInfo.seq_region_name, translation.start, translation.end, geneInfo.strand);
                        } catch (e) {
                            console.error("Failed to fetch canonical sequence:", e);
                            canonicalCDS = null;
                        }
                    }
                }
            }

            currGeneName = selectedEvent.event.geneName;
        }

        // Fetch server-side GTF annotation for the selected gene (optional)
        {
            const gtfId = settings.selectedGtfId;
            const geneKey = selectedEvent.event.geneName || selectedEvent.event.geneID;
            const newKey = `${gtfId}|${geneKey}`;
            if (gtfId && geneKey && currGtfKey !== newKey) {
                currGtfKey = newKey;
                try {
                    gtfGeneModel = await getGtfGeneModel({
                        id: gtfId,
                        geneName: selectedEvent.event.geneName,
                        geneId: selectedEvent.event.geneID,
                    });
                    gtfError = null;

                    const exons = getSplicingExons(selectedEvent.event);
                    const inclusionExons = exons.filter(exon => exon.inclusion && exon.type !== "junction");
                    const skippedExons = exons.filter(exon => (!exon.inclusion || exon.type === "upstream" || exon.type === "downstream" || exon.type === "flanking") && exon.type !== "junction");
                    const position = getPositionsFromData(selectedEvent.event);

                    const minInclusionPos = inclusionExons.length ? Math.min(...inclusionExons.map(e => e.start)) : Infinity;
                    const maxInclusionPos = inclusionExons.length ? Math.max(...inclusionExons.map(e => e.end)) : -Infinity;
                    const minSkippedPos = skippedExons.length ? Math.min(...skippedExons.map(e => e.start)) : Infinity;
                    const maxSkippedPos = skippedExons.length ? Math.max(...skippedExons.map(e => e.end)) : -Infinity;

                    gtfInclusionTranscripts = [];
                    gtfSkippedTranscripts = [];

                    for (const transcript of gtfGeneModel.transcripts) {
                        // Rough equivalence to Ensembl logic: inclusion form requires all inclusion exons be present (or RI matches by intron region)
                        const isInclusion = selectedEvent.event.eventType !== "RI"
                            ? inclusionExons.every(exon => transcript.exons.some(tExon => tExon.start === exon.start && tExon.end === exon.end))
                            : transcript.exons.some(tExon => tExon.start === position.start && tExon.end === position.end);
                        let isSkipped = skippedExons.every(exon => transcript.exons.some(tExon => tExon.start === exon.start && tExon.end === exon.end));

                        // Check for extra exons within the inclusion/skipped ranges
                        let inclusionOk = isInclusion;
                        if (selectedEvent!.event.eventType !== "RI" && inclusionExons.length) {
                            if (transcript.exons.some(tExon => {
                                return (
                                    ((tExon.start >= minInclusionPos && tExon.start <= maxInclusionPos) || (tExon.end >= minInclusionPos && tExon.end <= maxInclusionPos)) &&
                                    !inclusionExons.some(e => e.start === tExon.start && e.end === tExon.end)
                                );
                            }))
                                inclusionOk = false;
                        }

                        if (skippedExons.length) {
                            if (transcript.exons.some(tExon => {
                                return (
                                    ((tExon.start >= minSkippedPos && tExon.start <= maxSkippedPos) || (tExon.end >= minSkippedPos && tExon.end <= maxSkippedPos)) &&
                                    !skippedExons.some(e => e.start === tExon.start && e.end === tExon.end)
                                );
                            }))
                                isSkipped = false;
                        }

                        if (inclusionOk) gtfInclusionTranscripts.push(transcript);
                        if (isSkipped) gtfSkippedTranscripts.push(transcript);
                    }

                    const inclusionIds = new Set(gtfInclusionTranscripts.map(t => t.transcript_id));
                    const skippedIds = new Set(gtfSkippedTranscripts.map(t => t.transcript_id));
                    gtfUnidentifiedTranscripts = gtfGeneModel.transcripts.filter(t => !inclusionIds.has(t.transcript_id) && !skippedIds.has(t.transcript_id));
                } catch (e: any) {
                    console.error(e);
                    gtfGeneModel = null;
                    gtfInclusionTranscripts = [];
                    gtfSkippedTranscripts = [];
                    gtfUnidentifiedTranscripts = [];
                    gtfError = e?.message ?? "Failed to fetch server GTF annotation";
                }
            }

            // If user clears the GTF selection, reset state
            if (!gtfId) {
                currGtfKey = null;
                gtfGeneModel = null;
                gtfError = null;
                gtfInclusionTranscripts = [];
                gtfSkippedTranscripts = [];
                gtfUnidentifiedTranscripts = [];
            }
        }
        filteredEvents = selectedEvent.geneEvents.filter(event => {
            const readCountCheck = event.event.incCount1Avg >= settings.readCountThresh && event.event.incCount2Avg >= settings.readCountThresh && event.event.skipCount1Avg >= settings.readCountThresh && event.event.skipCount2Avg >= settings.readCountThresh;
            if (readCountThresh && !readCountCheck)
                return false;
            if (!useFilter) return true;

            const chromosomeCheck = settings.selectedChr === "All" || (event.event.chr && event.event.chr.startsWith(settings.selectedChr));
            const limitCheck = settings.extraneousPsiLimits === false || event.event.psi1Avg >= 0.05 && event.event.psi1Avg <= 0.95;
            const FDRCheck = event.event.FDR <= settings.FDRThresh;
            const psiDiffCheck = Math.abs(event.event.psiDiff) >= settings.psiDiffThresh;
            const sameEventCheck = !sameEventOnly || eventID(event.event) === eventID(selectedEvent!.event);
            return chromosomeCheck && limitCheck && FDRCheck && psiDiffCheck && sameEventCheck;
        }) || [];
        filteredEvents.sort((a, b) => eventID(a.event).localeCompare(eventID(b.event)));
        eventCounts = filteredEvents.reduce((acc, event) => {
            const eventType = event.event.eventType;
            acc[eventType] = (acc[eventType] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const exons = getSplicingExons(selectedEvent.event);
        const position = getPositionsFromData(selectedEvent.event);

        if (geneInfo && exons.length > 0) {
            const inclusionExons = exons.filter(exon => exon.inclusion && exon.type !== "junction");
            const skippedExons = exons.filter(exon => (!exon.inclusion || exon.type === "upstream" || exon.type === "downstream" || exon.type === "flanking") && exon.type !== "junction");

            // See which transcript the selected event belongs to, ensuring that there are no exons between the ones noted in inclusionEcons and skippedExons
            const transcripts = geneInfo.Transcript;
            for (const transcript of transcripts) {
                if (transcript.biotype === "retained_intron" && selectedEvent.event.eventType !== "RI") continue; // Skip retained intron transcripts if not a RI event

                let isInclusion = selectedEvent.event.eventType !== "RI" ? inclusionExons.every(exon => transcript.Exon.some(tExon => tExon.start === exon.start && tExon.end === exon.end)) : transcript.Exon.some(tExon => tExon.start === position.start && tExon.end === position.end);
                let isSkipped = skippedExons.every(exon => transcript.Exon.some(tExon => tExon.start === exon.start && tExon.end === exon.end));
                const minInclusionPos = Math.min(...inclusionExons.map(e => e.start));
                const maxInclusionPos = Math.max(...inclusionExons.map(e => e.end));
                const minSkippedPos = Math.min(...skippedExons.map(e => e.start));
                const maxSkippedPos = Math.max(...skippedExons.map(e => e.end));

                // Check if there are any exons in between inclusion and skipped exons
                if (selectedEvent!.event.eventType !== "RI" && transcript.Exon.some(tExon => {
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

            if (inclusionBestCandidate?.is_canonical) {
                inclusionBestCandidateCDS = canonicalCDS;
                inclusionBestCandidateMRNA = canonicalMRNA;
            } else if (inclusionBestCandidate) {
                try {
                    inclusionBestCandidateMRNA = "";
                    for (const exon of inclusionBestCandidate.Exon) {
                        inclusionBestCandidateMRNA += await getSequenceRegion(geneInfo!.seq_region_name, exon.start, exon.end, geneInfo!.strand)
                    }
                } catch (err) {
                    console.error("Failed to fetch inclusion best candidate mRNA sequence:", err);
                    inclusionBestCandidateMRNA = null;
                }
                if (inclusionBestCandidate.Translation) {
                    getSequenceRegion(
                        inclusionBestCandidate.seq_region_name,
                        inclusionBestCandidate.Translation.start,
                        inclusionBestCandidate.Translation.end,
                        geneInfo.strand,
                    ).then(seq => {
                        inclusionBestCandidateCDS = seq;
                    }).catch(err => {
                        console.error("Failed to fetch inclusion best candidate sequence:", err);
                        inclusionBestCandidateCDS = null;
                    });
                }
            }

            if (skippedBestCandidate?.is_canonical) {
                skippedBestCandidateCDS = canonicalCDS;
                skippedBestCandidateMRNA = canonicalMRNA;
            } else if (skippedBestCandidate) {
                try {
                    skippedBestCandidateMRNA = "";
                    for (const exon of skippedBestCandidate.Exon) {
                        skippedBestCandidateMRNA += await getSequenceRegion(geneInfo!.seq_region_name, exon.start, exon.end, geneInfo!.strand);
                    }
                } catch (err) {
                    console.error("Failed to fetch skipped best candidate mRNA sequence:", err);
                    skippedBestCandidateMRNA = null;
                }
                if (skippedBestCandidate.Translation) {
                    getSequenceRegion(
                        skippedBestCandidate.seq_region_name,
                        skippedBestCandidate.Translation.start,
                        skippedBestCandidate.Translation.end,
                        geneInfo.strand,
                    ).then(seq => {
                        skippedBestCandidateCDS = seq;
                    }).catch(err => {
                        console.error("Failed to fetch skipped best candidate sequence:", err);
                        skippedBestCandidateCDS = null;
                    });
                }
            }
        }

        loading = false;
        if (mustDraw)
            draw();
    }

    function drawHoverInfo(startX: number, endX: number, yStart: number, yEnd: number, colour: string, value: string) {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.strokeStyle = colour;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(startX, yStart);
        ctx.lineTo(startX, yEnd);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(endX, yStart);
        ctx.lineTo(endX, yEnd);
        ctx.stroke();

        ctx.font = '10px Inconsolata';
        ctx.textAlign = 'center';
        ctx.fillStyle = colour;
        ctx.fillText(value, startX + (endX - startX) / 2, yStart - 20);
    }

    function draw() {
        const selectedEvent = getSelectedEvent();
        if (!canvas) {
            requestAnimationFrame(draw);
            return;
        }
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Reset canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!selectedEvent || (!geneInfo && !gtfGeneModel)) {
            requestAnimationFrame(draw);
            return;
        }

        // Get text color from CSS custom property
        const textColour = getComputedStyle(document.documentElement).getPropertyValue('--text-color').trim() || '#1e1e1e';

        const exons = getSplicingExons(selectedEvent.event);
        if (!exons.length) return;
        const inclusionExons = exons.filter(exon => exon.inclusion && exon.type !== "junction");
        const skippedExons = exons.filter(exon => (!exon.inclusion || exon.type === "upstream" || exon.type === "downstream" || exon.type === "flanking") && exon.type !== "junction"); // Exons that are not effected by the event have inclusion = true
        const junctions = exons.filter(exon => exon.type === "junction");

        const useServerGtf = isUsingServerGtf();

        // Currently "exon_number" is corresponding to each transcript; map to genomic location instead.
        // Build unique exon list from whichever annotation is active.
        let uniqueGenes: ({ start: number; end: number; strand: 1 | -1; exon_number?: number })[] = [];
        if (useServerGtf && gtfGeneModel) {
            const allExons = gtfGeneModel.transcripts.flatMap(t => t.exons.map(e => ({
                start: e.start,
                end: e.end,
                strand: t.strand === "-" ? -1 : 1 as 1 | -1,
            })));
            uniqueGenes = allExons.filter((g, index, self) => index === self.findIndex(t => t.start === g.start && t.end === g.end));
            uniqueGenes.sort((a, b) => a.start - b.start);
            uniqueGenes = uniqueGenes.map((g, index) => ({
                ...g,
                exon_number: g.strand === 1 ? index + 1 : uniqueGenes.length - index
            }));
        } else if (geneInfo) {
            const transcripts = geneInfo.Transcript;
            uniqueGenes = transcripts
                .flatMap(transcript => transcript.Exon)
                .map(e => ({ start: e.start, end: e.end, strand: (e.strand as 1 | -1) }))
                .filter((g, index, self) => index === self.findIndex(t => t.start === g.start && t.end === g.end));
            uniqueGenes.sort((a, b) => a.start - b.start);
            uniqueGenes = uniqueGenes.map((g, index) => ({
                ...g,
                exon_number: g.strand === 1 ? index + 1 : uniqueGenes.length - index
            }));
        }
        
        // Get position range for scaling
        const positions = getPositionsFromData(selectedEvent.event);
        const absoluteStart = Math.min(positions.start, ...(uniqueGenes.length ? uniqueGenes.map(g => g.start) : [positions.start]));
        const absoluteEnd = Math.max(positions.end, ...(uniqueGenes.length ? uniqueGenes.map(g => g.end) : [positions.end]));
        const totalRange = absoluteEnd - absoluteStart;
        
        // Apply zoom and offset
        const visibleRange = totalRange / zoomLevel;
        const adjustedMin = absoluteStart + xOffset * totalRange;
        const adjustedMax = Math.min(absoluteEnd, adjustedMin + visibleRange);
        const posRange = adjustedMax - adjustedMin;
        
        // Define visual properties
        const transcriptCount = useServerGtf && gtfGeneModel ? gtfGeneModel.transcripts.length : geneInfo ? geneInfo.Transcript.length : 0;
        
        // Calculate required dimensions first
        const topPadding = 100;
        const bottomPadding = 50; // Fixed bottom padding
        const minExonHeight = 10;
        const pathGap = Math.min(10, Math.max(3, 50 / transcriptCount)); // Adaptive gap
        
        // Calculate total height needed for all transcript rows plus inclusion/skipped paths
        const totalRows = transcriptCount + 2; // transcripts + inclusion + skipped paths
        let exonHeight = Math.max(minExonHeight, 20 / Math.sqrt(transcriptCount)); // Adaptive exon height
        
        const contentHeight = totalRows * exonHeight + (totalRows - 1) * pathGap;
        canvas.height = topPadding + contentHeight + bottomPadding;
        
        // Define layout
        const [x, y, width] = [25, topPadding, canvas.width - 100];
        const yInclusionPath = y + (exonHeight + pathGap) * transcriptCount + exonHeight / 2;
        const ySkippedPath = y + (exonHeight + pathGap) * (transcriptCount + 1) + exonHeight / 2;

        // Scale dash size to the amount of transcripts
        ctx.setLineDash([5, 3 * Math.sqrt(transcriptCount)]);

        // Function to scale genomic position to canvas x coordinate
        const scaleX = (pos: number) => ((pos - adjustedMin) / posRange) * width + x
        
        // Draw inclusion path exons (solid)
        ctx.fillStyle = colours.inclusion;
        inclusionExons.forEach(exon => {
            // Only draw if within visible range
            if (exon.end < adjustedMin || exon.start > adjustedMax) return;

            const exonX = Math.max(scaleX(exon.start), x);
            const exonWidth = Math.min(scaleX(exon.end), x + width) - exonX;
            ctx!.fillRect(exonX, yInclusionPath - exonHeight/2, exonWidth, exonHeight);

            if (mouseData &&
                mouseData.x >= exonX &&
                mouseData.x <= exonX + exonWidth &&
                mouseData.y >= yInclusionPath - exonHeight/2 &&
                mouseData.y <= yInclusionPath + exonHeight/2
            ) {
                drawHoverInfo(exonX, exonX + exonWidth, y, ySkippedPath + exonHeight/2, colours.inclusion, `${exon.end - exon.start} nt`);
            }
        });
        
        // Draw skipped path exons (solid)
        ctx.fillStyle = colours.skipped;  // Red for skipped path
        skippedExons.forEach(exon => {
            // Only draw if within visible range
            if (exon.end < adjustedMin || exon.start > adjustedMax) return;

            const exonX = Math.max(scaleX(exon.start), x);
            const exonWidth = Math.min(scaleX(exon.end), x + width) - exonX;
            ctx!.fillRect(exonX, ySkippedPath - exonHeight/2, exonWidth, exonHeight);

            if (mouseData &&
                mouseData.x >= exonX &&
                mouseData.x <= exonX + exonWidth &&
                mouseData.y >= ySkippedPath - exonHeight/2 &&
                mouseData.y <= ySkippedPath + exonHeight/2
            ) {
                drawHoverInfo(exonX, exonX + exonWidth, y, ySkippedPath + exonHeight/2, colours.skipped, `${exon.end - exon.start} nt`);
            }
        });
        
        // Draw junctions (dashed)
        ctx.lineWidth = 2;
        junctions.forEach(junction => {
            // Only draw if within visible range
            if (junction.end < adjustedMin || junction.start > adjustedMax) return;

            const startX = Math.max(scaleX(junction.start), x);
            const endX = Math.min(scaleX(junction.end), x + width);
            const path = junction.inclusion ? yInclusionPath : ySkippedPath;
            const colour = junction.inclusion ? colours.inclusion : colours.skipped;

            ctx.strokeStyle = colour;
            ctx!.beginPath();
            ctx!.moveTo(startX, path);
            ctx!.lineTo(endX, path);
            ctx!.stroke();

            if (
                mouseData &&
                mouseData.x >= startX &&
                mouseData.x <= endX &&
                mouseData.y >= path - exonHeight/2 &&
                mouseData.y <= path + exonHeight/2
            ) {
                drawHoverInfo(startX, endX, y, ySkippedPath + exonHeight/2, colour, `${junction.end - junction.start} nt`);
                ctx.lineWidth = 2;
            }
        });

        // Draw Transcripts - each transcript gets its own row
        if (useServerGtf && gtfGeneModel) {
            gtfGeneModel.transcripts.forEach((transcript, index) => {
                const yTranscriptPath = y + exonHeight / 2 + (index * (exonHeight + pathGap));

                let transcriptColor = colours.gtf;
                const transcriptID = transcript.transcript_id;
                const inInclusion = gtfInclusionTranscripts.some(t => t.transcript_id === transcriptID);
                const inSkipped = gtfSkippedTranscripts.some(t => t.transcript_id === transcriptID);
                if (inInclusion && inSkipped)
                    transcriptColor = colours.combined;
                else if (inInclusion)
                    transcriptColor = colours.inclusion;
                else if (inSkipped)
                    transcriptColor = colours.skipped;

                transcript.exons.forEach(exon => {
                    if (exon.end < adjustedMin || exon.start > adjustedMax) return;
                    const exonX = Math.max(scaleX(exon.start), x);
                    const exonWidth = Math.min(scaleX(exon.end), x + width) - exonX;

                    ctx.fillStyle = transcriptColor;
                    ctx.fillRect(exonX, yTranscriptPath - exonHeight/2, exonWidth, exonHeight);

                    if (
                        mouseData &&
                        mouseData.x >= exonX &&
                        mouseData.x <= exonX + exonWidth &&
                        mouseData.y >= yTranscriptPath - exonHeight/2 &&
                        mouseData.y <= yTranscriptPath + exonHeight/2
                    ) {
                        drawHoverInfo(exonX, exonX + exonWidth, y, ySkippedPath + exonHeight/2, transcriptColor, `${exon.end - exon.start} nt - ${transcriptID} - E${uniqueGenes.find(g => g.start === exon.start && g.end === exon.end)?.exon_number || 'N/A'}`);
                    }
                });
            });
        } else if (geneInfo) {
            geneInfo.Transcript.forEach((transcript, index) => {
                const yTranscriptPath = y + exonHeight / 2 + (index * (exonHeight + pathGap));

                let transcriptColor = colours.gtf;
                const transcriptID = `${transcript.id}.${transcript.version}`
                if (inclusionTranscripts.some(t => `${t.id}.${t.version}` === transcriptID) && skippedTranscripts.some(t => `${t.id}.${t.version}` === transcriptID))
                    transcriptColor = colours.combined;
                else if (inclusionTranscripts.some(t => `${t.id}.${t.version}` === transcriptID))
                    transcriptColor = colours.inclusion;
                else if (skippedTranscripts.some(t => `${t.id}.${t.version}` === transcriptID))
                    transcriptColor = colours.skipped;
                else if (transcriptID === geneInfo?.canonical_transcript)
                    transcriptColor = colours.canonical;

                transcript.Exon.forEach(exon => {
                    if (exon.end < adjustedMin || exon.start > adjustedMax) return;
                    const exonX = Math.max(scaleX(exon.start), x);
                    const exonWidth = Math.min(scaleX(exon.end), x + width) - exonX;

                    ctx.fillStyle = transcriptColor;
                    ctx.fillRect(exonX, yTranscriptPath - exonHeight/2, exonWidth, exonHeight);

                    if (
                        mouseData &&
                        mouseData.x >= exonX &&
                        mouseData.x <= exonX + exonWidth &&
                        mouseData.y >= yTranscriptPath - exonHeight/2 &&
                        mouseData.y <= yTranscriptPath + exonHeight/2
                    ) {
                        drawHoverInfo(exonX, exonX + exonWidth, y, ySkippedPath + exonHeight/2, transcriptColor, `${exon.end - exon.start} nt - ${transcriptID} - E${uniqueGenes.find(g => g.start === exon.start && g.end === exon.end)?.exon_number || 'N/A'}`);
                    }
                });
            });
        }
        
        // Add labels
        ctx.fillStyle = textColour;
        ctx.font = '12px Inconsolata';
        ctx.textAlign = 'center';
        
        // Draw splicing type label
        ctx.fillText(selectedEvent.event.eventType, x + width/2, y - 50);
        
        // Draw strand indicator with fixed position relative to content
        const strandSymbol = selectedEvent.event.strand === '+' ? '→' : '←';
        ctx.fillText(`${strandSymbol} ${selectedEvent.event.strand} strand`, x + width/2, ySkippedPath + exonHeight/2 + 30);
        
        // Labels for inclusion/skipped paths
        ctx.fillStyle = colours.inclusion;
        ctx.fillText(`Inclusion`, width + x + 32, yInclusionPath);
        ctx.fillStyle = colours.skipped;
        ctx.fillText(`Skipped`, width + x + 38, ySkippedPath);

        // X axis
        ctx.strokeStyle = textColour;
        ctx.setLineDash([]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + width, 0);
        ctx.stroke();
        
        ctx.fillStyle = textColour;
        ctx.font = "10px Inconsolata";
        ctx.textAlign = "center";

        const tickCount = 4;
        const tickInterval = posRange / tickCount;
        
        for (let i = 0; i <= tickCount; i++) {
            const position = adjustedMin + i * tickInterval;
            const xPos = (i / tickCount) * width + x;            
            ctx.beginPath();
            ctx.moveTo(xPos, 0);
            ctx.lineTo(xPos, 5);
            ctx.stroke();
            
            const label = selectedEvent.event.strand === "+" ? Math.round(position - absoluteStart) : Math.round(absoluteEnd - position);
            ctx.fillText(label.toString(), xPos, 15);
        }
        
        ctx.textAlign = "left";
        ctx.font = "10px Inconsolata";
        ctx.fillText("Position (nt)", 5, 25);

        // Draw zoom indicator
        ctx.textAlign = "right";
        ctx.fillText(`Zoom: ${zoomLevel.toFixed(1)}x`, canvas.width - 10, 25);
    }

    function handleMouseMove(event: MouseEvent) {
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        if (drag) {
            // Calculate how much the mouse has moved
            const dx = lastMouseX - x;
            lastMouseX = x;
            
            // Adjust xOffset based on mouse movement and current zoom level
            if (!selectedEvent) return;
            
            // Convert pixel movement to genomic position proportion
            const moveAmount = dx / canvas.width * (1 / zoomLevel);
            xOffset = Math.max(0, Math.min(1 - (1/zoomLevel), xOffset + moveAmount));
            
            draw();
        } else {
            mouseData = { x, y };
            draw();
        }
    }

    function handleMouseDown(event: MouseEvent) {
        if (!canvas) return;
        drag = true;
        const rect = canvas.getBoundingClientRect();
        lastMouseX = event.clientX - rect.left;
        canvas.style.cursor = "grabbing";
    }

    function handleMouseUp() {
        drag = false;
        if (canvas) canvas.style.cursor = "default";
    }

    function handleMouseLeave() {
        drag = false;
        mouseData = null;
        if (canvas) canvas.style.cursor = "default";
        draw();
    }

    function handleWheel(event: WheelEvent) {
        if (!canvas || !selectedEvent) return;
        
        event.preventDefault();
        
        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseProportion = (mouseX - 25) / (canvas.width - 100);
        
        // Calculate zoom level change
        const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
        const newZoomLevel = Math.min(1000, Math.max(1, zoomLevel * zoomFactor));
        
        // Keep the mouse position fixed relative to the genomic position
        const oldVisibleProportion = 1 / zoomLevel;
        const newVisibleProportion = 1 / newZoomLevel;
        const oldOffset = xOffset;
        const offsetUnderMouse = oldOffset + mouseProportion * oldVisibleProportion;
        const newOffset = offsetUnderMouse - mouseProportion * newVisibleProportion;
        
        zoomLevel = newZoomLevel;
        xOffset = Math.max(0, Math.min(1 - (1/zoomLevel), newOffset));
        
        draw();
    }

    function resetView() {
        zoomLevel = 1;
        xOffset = 0;
        draw();
    }

    function zoomToEvent() {
        if (!selectedEvent || !geneInfo) return;
        const positions = getPositionsFromData(selectedEvent.event);
        const uniqueGenes = geneInfo.Transcript.flatMap(transcript => transcript.Exon).filter((g, index, self) => index === self.findIndex(t => Math.abs(t.start - g.start) < 3 && Math.abs(t.end - g.end) < 3));
        const absoluteStart = Math.min(positions.start, ...uniqueGenes.map(g => g.start));
        const absoluteEnd = Math.max(positions.end, ...uniqueGenes.map(g => g.end));

        const totalRange = absoluteEnd - absoluteStart;
        const eventRange = positions.end - positions.start;

        // Set zoom level to fit the event
        zoomLevel = totalRange / eventRange;
        xOffset = (positions.start - absoluteStart) / (absoluteEnd - absoluteStart);
        
        draw();
    }

    function changeFilter(value: boolean) {
        useFilter = value;
        updateValues();
    }

    function changeReadCountThresh(value: boolean) {
        readCountThresh = value;
        updateValues();
    }

    function changeSameEventOnly(value: boolean) {
        sameEventOnly = value;
        updateValues();
    }

    function copyToClipboard(text: string) {
        navigator.clipboard.writeText(text).then(() => {
            setTooltipHTML("Copied to clipboard!");
            setTimeout(() => {
                if (getTooltipHTML() === "Copied to clipboard!")
                    setTooltipHTML("");
            }, 2000);
        }).catch(err => {
            console.error("Failed to copy text:", err);
        });
    }

    rootObserver(draw);
    updatedSelectedEvent.addEventListener("update", () => {
        updateValues(false);
        zoomToEvent();
    });
</script>

{#if selectedEvent}
    {@const selectedPositions = getPositionsFromData(selectedEvent.event)}
    <div id="splicing-detail-panel">
        <button
            class="close-button"
            aria-label="Close"
            onclick={() => setSelectedEvent(null)}
        >X</button>
        <h3 class="event-header" style="color: {selectedEvent.strain.colour}">{selectedEvent.event.geneName || selectedEvent.event.geneID} - {selectedEvent.event.eventType}</h3>
        <div class="canvas-controls">
            <button class="reset-view-button" onclick={resetView}>
                Full Gene Context
            </button>
            <button class="reset-view-button" onclick={zoomToEvent}>
                Zoom to Event
            </button>
            <span class="zoom-instructions">Use mouse wheel to zoom, drag to pan</span>
        </div>
        <br>
        <canvas
            id="splicing-canvas"
            width="700"
            height="300"
            bind:this={canvas}
            onmousedown={handleMouseDown}
            onmouseup={handleMouseUp}
            onmouseleave={handleMouseLeave}
            onmousemove={handleMouseMove}
            onclick={() => {}} 
            onwheel={handleWheel}
            style="display: block; margin: 0 auto; padding: 5px; box-shadow: 0 0 10px rgba(0,0,0,0.1);"
        ></canvas>
        {#if !loading}
            <div class="info-divs">
                <div class="info-div">
                    <p style="margin-top: 12px; color: var(--text-color);">
                        <strong>Server GTF annotation:</strong>
                        {#if !settings.selectedGtfId}
                            None selected
                        {:else if gtfError}
                            <span style="color: {colours.skipped}">{gtfError}</span>
                        {:else if gtfGeneModel}
                            <span style="opacity: 0.85;">{gtfGeneModel.gtf.name}</span>
                            <br>
                            <span style="color: {colours.inclusion}">
                                <strong>Inclusion transcripts:</strong>
                                {#if gtfInclusionTranscripts.length}
                                    {#each gtfInclusionTranscripts as t, i}
                                        {#if i > 0},{/if} {t.transcript_id}
                                    {/each}
                                {:else}
                                    N/A
                                {/if}
                            </span>
                            <br>
                            <span style="color: {colours.skipped}">
                                <strong>Skipped transcripts:</strong>
                                {#if gtfSkippedTranscripts.length}
                                    {#each gtfSkippedTranscripts as t, i}
                                        {#if i > 0},{/if} {t.transcript_id}
                                    {/each}
                                {:else}
                                    N/A
                                {/if}
                            </span>
                            <br>
                            <span style="color: {colours.gtf}">
                                <strong>Unidentified transcripts:</strong>
                                {#if gtfUnidentifiedTranscripts.length}
                                    {#each gtfUnidentifiedTranscripts as t, i}
                                        {#if i > 0},{/if} {t.transcript_id}
                                    {/each}
                                {:else}
                                    None
                                {/if}
                            </span>
                        {:else}
                            Loading…
                        {/if}
                    </p>

                    <details open={!settings.selectedGtfId}>
                        <summary style="cursor: pointer; margin-top: 8px;">Ensembl annotation (click to {settings.selectedGtfId ? "expand" : "collapse"})</summary>

                        <p style="color: {colours.canonical}">
                            <strong>Canonical transcript:</strong>
                            {#if geneInfo}
                                <a href="https://genome.ucsc.edu/cgi-bin/hgGene?hgg_gene={geneInfo.canonical_transcript}" target="_blank" rel="noopener noreferrer">
                                    {geneInfo.canonical_transcript}
                                </a>
                            {:else}
                                N/A
                            {/if}
                        </p>
                        {#if canonicalCDS && canonicalMRNA}
                            <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                            <p
                                style="color: {colours.canonical}"
                                class="rna-seq"
                                onclick={() => copyToClipboard(canonicalCDS!)}
                                onkeydown={() => copyToClipboard(canonicalCDS!)}
                                aria-label="Click to copy RNA sequence"
                            >
                                <strong>Canonical CDS ({canonicalCDS.length} nt)<br>(click to copypaste):</strong>
                                <span class="clickable">
                                    {canonicalCDS}
                                </span>
                                <br>
                                <strong>Start Codon:</strong> {canonicalCDS.slice(0, 3)} | <strong>Stop Codon:</strong> {canonicalCDS.slice(-3)}
                            </p>
                            <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                            <p
                                style="color: {colours.canonical}"
                                class="rna-seq"
                                onclick={() => copyToClipboard(canonicalMRNA!)}
                                onkeydown={() => copyToClipboard(canonicalMRNA!)}
                                aria-label="Click to copy mRNA sequence"
                            >
                                <strong>Canonical mRNA ({canonicalMRNA.length} nt)<br>(click to copypaste):</strong>
                                <span class="clickable">
                                    {canonicalMRNA}
                                </span>
                            </p>
                        {/if}
                        <p style="color: {colours.inclusion}">
                            <strong>Inclusion form transcript:</strong>
                            {#if inclusionTranscripts.length > 0}
                                {#each inclusionTranscripts as inclusionTranscript, i}
                                    {#if i > 0},{/if}
                                    <a
                                        style="color: {geneInfo?.canonical_transcript === `${inclusionTranscript.id}.${inclusionTranscript.version}` ? colours.canonical : "inherit"}"
                                        href="https://genome.ucsc.edu/cgi-bin/hgGene?hgg_gene={inclusionTranscript.id}.{inclusionTranscript.version}"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        {inclusionTranscript.id}.{inclusionTranscript.version}
                                    </a>
                                {/each}
                            {:else}
                                N/A
                            {/if}
                            <br>
                            {#if inclusionBestCandidate}
                                <strong>Best candidate:</strong>
                                <a
                                    style="color: {geneInfo?.canonical_transcript === `${inclusionBestCandidate.id}.${inclusionBestCandidate.version}` ? colours.canonical : "inherit"}"
                                    href="https://genome.ucsc.edu/cgi-bin/hgGene?hgg_gene={inclusionBestCandidate.id}.{inclusionBestCandidate.version}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {inclusionBestCandidate.id}.{inclusionBestCandidate.version}
                                </a>
                                <br>
                                <strong>Biotype:</strong>
                                {inclusionBestCandidate.biotype}
                                <br>
                                {#if inclusionBestCandidateCDS && inclusionBestCandidateMRNA}
                                    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                                    <span
                                        class="rna-seq"
                                        aria-label="Click to copy RNA sequence"
                                        onclick={() => copyToClipboard(inclusionBestCandidateCDS!)}
                                        onkeydown={() => copyToClipboard(inclusionBestCandidateCDS!)}
                                    >
                                        <strong>Inclusion CDS ({inclusionBestCandidateCDS.length} nt)<br>(click to copypaste):</strong>
                                        <span class="clickable">
                                            {inclusionBestCandidateCDS}
                                        </span>
                                        <br>
                                        <strong>Start Codon:</strong> {inclusionBestCandidateCDS.slice(0, 3)} | <strong>Stop Codon:</strong> {inclusionBestCandidateCDS.slice(-3)}
                                    </span>
                                    <br>
                                    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                                    <span
                                        class="rna-seq"
                                        aria-label="Click to copy mRNA sequence"
                                        onclick={() => copyToClipboard(inclusionBestCandidateMRNA!)}
                                        onkeydown={() => copyToClipboard(inclusionBestCandidateMRNA!)}
                                    >
                                        <strong>Inclusion mRNA ({inclusionBestCandidateMRNA.length} nt)<br>(click to copypaste):</strong>
                                        <span class="clickable">
                                            {inclusionBestCandidateMRNA}
                                        </span>
                                    </span>
                                {/if}
                            {/if}
                        </p>
                        <p style="color: {colours.skipped}">
                            <strong>Skipped form Transcript:</strong>
                            {#if skippedTranscripts.length > 0}
                                {#each skippedTranscripts as skippedTranscript, i}
                                    {#if i > 0},{/if}
                                    <a
                                        style="color: {geneInfo?.canonical_transcript === `${skippedTranscript.id}.${skippedTranscript.version}` ? colours.canonical : "inherit"}"
                                        href="https://genome.ucsc.edu/cgi-bin/hgGene?hgg_gene={skippedTranscript.id}.{skippedTranscript.version}"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        {skippedTranscript.id}.{skippedTranscript.version}
                                    </a>
                                {/each}
                            {:else}
                                N/A
                            {/if}
                            <br>
                            {#if skippedBestCandidate}
                                <strong>Best candidate:</strong>
                                <a
                                    style="color: {geneInfo?.canonical_transcript === `${skippedBestCandidate.id}.${skippedBestCandidate.version}` ? colours.canonical : "inherit"}"
                                    href="https://genome.ucsc.edu/cgi-bin/hgGene?hgg_gene={skippedBestCandidate.id}.{skippedBestCandidate.version}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {skippedBestCandidate.id}.{skippedBestCandidate.version}
                                </a>
                                <br>
                                <strong>Biotype:</strong>
                                {skippedBestCandidate.biotype}
                                <br>
                                {#if skippedBestCandidateCDS && skippedBestCandidateMRNA}
                                    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                                    <span
                                        class="rna-seq"
                                        aria-label="Click to copy RNA sequence"
                                        onclick={() => copyToClipboard(skippedBestCandidateCDS!)}
                                        onkeydown={() => copyToClipboard(skippedBestCandidateCDS!)}
                                    >
                                        <strong>Skipped CDS ({skippedBestCandidateCDS.length} nt)<br>(click to copypaste):</strong>
                                        <span class="clickable">
                                            {skippedBestCandidateCDS}
                                        </span>
                                        <br>
                                        <strong>Start Codon:</strong> {skippedBestCandidateCDS.slice(0, 3)} | <strong>Stop Codon:</strong> {skippedBestCandidateCDS.slice(-3)}
                                    </span>
                                    <br>
                                    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                                    <span
                                        class="rna-seq"
                                        aria-label="Click to copy mRNA sequence"
                                        onclick={() => copyToClipboard(skippedBestCandidateMRNA!)}
                                        onkeydown={() => copyToClipboard(skippedBestCandidateMRNA!)}
                                    >
                                        <strong>Skipped mRNA ({skippedBestCandidateMRNA.length} nt)<br>(click to copypaste):</strong>
                                        <span class="clickable">
                                            {skippedBestCandidateMRNA}
                                        </span>
                                    </span>
                                {/if}
                            {/if}
                        </p>
                    </details>
                    <p><strong>Chromosome:</strong> {selectedEvent.event.chr} ({selectedEvent.event.strand} strand)</p>
                    <p><strong>FDR:</strong> {Math.abs(selectedEvent.event.FDR) < 0.001 ? selectedEvent.event.FDR.toExponential(3) : selectedEvent.event.FDR.toFixed(3)}</p>
                    <p><strong>Inclusion Level Difference (ΔΨ):</strong> {Math.abs(selectedEvent.event.psiDiff) < 0.001 ? selectedEvent.event.psiDiff.toExponential(3) : selectedEvent.event.psiDiff.toFixed(3)}</p>
                    <p style="color: {significance === 'Upregulated' ? 'rgb(255,0,0)' : significance === 'Downregulated' ? 'rgb(0,0,255)' : 'initial'}"><strong>Significance:</strong> {significance}</p>
                    <p><strong>Total Position:</strong> {selectedPositions.start} - {selectedPositions.end}</p>
                    <p><strong>Inclusion Level 1 Avg.:</strong> {Math.abs(selectedEvent.event.psi1Avg) < 0.001 ? selectedEvent.event.psi1Avg.toExponential(3) : selectedEvent.event.psi1Avg.toFixed(3)}</p>
                    <p><strong>Inclusion Level 2 Avg.:</strong> {Math.abs(selectedEvent.event.psi2Avg) < 0.001 ? selectedEvent.event.psi2Avg.toExponential(3) : selectedEvent.event.psi2Avg.toFixed(3)}</p>
                    <p><strong>Inclusion Read Count 1 Avg.:</strong> {selectedEvent.event.incCount1Avg.toFixed(3)}</p>
                    <p><strong>Inclusion Read Count 2 Avg.:</strong> {selectedEvent.event.incCount2Avg.toFixed(3)}</p>
                    <p><strong>Skipped Read Count 1 Avg.:</strong> {selectedEvent.event.skipCount1Avg.toFixed(3)}</p>
                    <p><strong>Skipped Read Count 2 Avg.:</strong> {selectedEvent.event.skipCount2Avg.toFixed(3)}</p>
                    {#if selectedEvent.event.eventType === 'SE'}
                        {@const seEvent = selectedEvent.event as SEEvent}
                        <p><strong>Target Exon:</strong> {seEvent.exonStart} - {seEvent.exonEnd}</p>
                        <p><strong>Upstream Exon:</strong> {seEvent.upstreamExonStart} - {seEvent.upstreamExonEnd}</p>
                        <p><strong>Downstream Exon:</strong> {seEvent.downstreamExonStart} - {seEvent.downstreamExonEnd}</p>
                        <p><strong>Target Read Count:</strong> {arrayToString(seEvent.targetCount)}</p>
                        <p><strong>Upstream to Target Count:</strong> {arrayToString(seEvent.upstreamToTargetCount)}</p>
                        <p><strong>Target to Downstream Count:</strong> {arrayToString(seEvent.targetToDownstreamCount)}</p>
                        <p><strong>Upstream to Downstream Count:</strong> {arrayToString(seEvent.upstreamToDownstreamCount)}</p>
                    {:else if selectedEvent.event.eventType === 'MXE'}
                        {@const mxeEvent = selectedEvent.event as MXEEvent}
                        <p><strong>First Exon:</strong> {mxeEvent.exon1Start} - {mxeEvent.exon1End}</p>
                        <p><strong>Second Exon:</strong> {mxeEvent.exon2Start} - {mxeEvent.exon2End}</p>
                        <p><strong>Upstream Exon:</strong> {mxeEvent.upstreamExonStart} - {mxeEvent.upstreamExonEnd}</p>
                        <p><strong>Downstream Exon:</strong> {mxeEvent.downstreamExonStart} - {mxeEvent.downstreamExonEnd}</p>
                        <p><strong>First Read Count:</strong> {arrayToString(mxeEvent.firstCount)}</p>
                        <p><strong>Second Read Count:</strong> {arrayToString(mxeEvent.secondCount)}</p>
                        <p><strong>Upstream to First Count:</strong> {arrayToString(mxeEvent.upstreamToFirstCount)}</p>
                        <p><strong>Upstream to Second Count:</strong> {arrayToString(mxeEvent.upstreamToSecondCount)}</p>
                        <p><strong>First to Downstream Count:</strong> {arrayToString(mxeEvent.firstToDownstreamCount)}</p>
                        <p><strong>Second to Downstream Count:</strong> {arrayToString(mxeEvent.secondToDownstreamCount)}</p>
                    {:else if selectedEvent.event.eventType === 'A3SS' || selectedEvent.event.eventType === 'A5SS'}
                        {@const assEvent = selectedEvent.event as ASSEvent}
                        <p><strong>Long Exon:</strong> {assEvent.longExonStart} - {assEvent.longExonEnd}</p>
                        <p><strong>Short Exon:</strong> {assEvent.shortExonStart} - {assEvent.shortExonEnd}</p>
                        <p><strong>Flanking Exon:</strong> {assEvent.flankingExonStart} - {assEvent.flankingExonEnd}</p>
                        <p><strong>Across Short Boundary Count:</strong> {arrayToString(assEvent.acrossShortBoundaryCount)}</p>
                        <p><strong>Long to Flanking Count:</strong> {arrayToString(assEvent.longToFlankingCount)}</p>
                        <p><strong>Exclusive to Long Count:</strong> {arrayToString(assEvent.exclusiveToLongCount)}</p>
                        <p><strong>Short to Flanking Count:</strong> {arrayToString(assEvent.shortToFlankingCount)}</p>
                    {:else if selectedEvent.event.eventType === 'RI'}
                        {@const riEvent = selectedEvent.event as RIEvent}
                        <p><strong>RI Exon:</strong> {riEvent.riExonStart} - {riEvent.riExonEnd}</p>
                        <p><strong>Upstream Exon:</strong> {riEvent.upstreamExonStart} - {riEvent.upstreamExonEnd}</p>
                        <p><strong>Downstream Exon:</strong> {riEvent.downstreamExonStart} - {riEvent.downstreamExonEnd}</p>
                        <p><strong>Intron Count:</strong> {arrayToString(riEvent.intronCount)}</p>
                        <p><strong>Upstream to Intron Count:</strong> {arrayToString(riEvent.upstreamToIntronCount)}</p>
                        <p><strong>Intron to Downstream Count:</strong> {arrayToString(riEvent.intronToDownstreamCount)}</p>
                        <p><strong>Upstream to Downstream Count:</strong> {arrayToString(riEvent.upstreamToDownstreamCount)}</p>
                    {/if}
                    <ViolinChart
                        keys={["Ψ1", "Ψ2"]}
                        data={[filteredEvents.flatMap(event => event.event.psi1), filteredEvents.flatMap(event => event.event.psi2)]}
                        updateOnFilter="selectedEvent"
                        enforcedStats={{ min: 0, max: 1 }}
                    ></ViolinChart>
                    <PieChart
                        data={eventCounts}
                    ></PieChart>
                    <VolcanoChart
                        data={[selectedEvent.event, ...selectedEvent.geneEvents.map(e => e.event)]}
                        strain={{ name: selectedEvent.strain.name, colour: selectedEvent.strain.colour }}
                        updateOnFilter="selectedEvent"
                    ></VolcanoChart>
                </div>
                {#if selectedEvent.geneEvents.length > 0}
                    <div class="info-div">
                        <h4>All events for this Gene ({filteredEvents.length} events)<br>
                            Select below to view the details of each event.</h4>
                        <button
                            class="toggle-filter"
                            style="margin-bottom: 10px;"
                            onclick={() => changeFilter(!useFilter)}
                        >
                            {useFilter ? "Disable Filter" : "Enable Filter"}
                        </button>
                        <button
                            class="toggle-filter"
                            onclick={() => changeReadCountThresh(!readCountThresh)}
                        >
                            {readCountThresh ? "Disable Read Count Threshold" : "Enable Read Count Threshold"}
                        </button>
                        <button
                            class="toggle-filter"
                            onclick={() => changeSameEventOnly(!sameEventOnly)}
                        >
                            {sameEventOnly ? "Disable Same Event Filter" : "Enable Same Event Filter"}
                        </button>
                        <ul>
                            {#each filteredEvents as event}
                                {@const positions = getPositionsFromData(event.event)}
                                <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                                <li
                                    style="color: {event.strain.colour}; cursor: pointer;"
                                    onclick={() => {
                                        setSelectedEvent(event);
                                        draw();
                                    }}
                                    onkeydown={() => {
                                        setSelectedEvent(event);
                                        draw();
                                    }}
                                >
                                    <span style="text-decoration: underline;">
                                        {#if selectedEvent.event.ID === event.event.ID && selectedEvent.strain.name === event.strain.name}
                                            <strong>{event.strain.name} (Selected)</strong>
                                        {:else}
                                            {event.strain.name}
                                        {/if}
                                    </span>
                                    <ul>
                                        {#if eventID(event.event) === eventID(selectedEvent.event) && `${event.strain.name}_${event.event.ID}` !== `${selectedEvent.strain.name}_${selectedEvent.event.ID}`}
                                            <li><strong>(Same Event)</strong></li>
                                        {/if}
                                        <li style="color: {eventColours[event.event.eventType]}">Event Type: {event.event.eventType}</li>
                                        <li>FDR: {Math.abs(event.event.FDR) < 0.001 && event.event.FDR !== 0 ? event.event.FDR.toExponential(3) : event.event.FDR.toFixed(3)}</li>
                                        <li>Inclusion Level Difference (ΔΨ): {Math.abs(event.event.psiDiff) < 0.001 ? event.event.psiDiff.toExponential(3) : event.event.psiDiff.toFixed(3)}</li>
                                        <li>Inclusion Read Count 1 Avg.: {event.event.incCount1Avg.toFixed(3)}</li>
                                        <li>Inclusion Read Count 2 Avg.: {event.event.incCount2Avg.toFixed(3)}</li>
                                        <li>Skipped Read Count 1 Avg.: {event.event.skipCount1Avg.toFixed(3)}</li>
                                        <li>Skipped Read Count 2 Avg.: {event.event.skipCount2Avg.toFixed(3)}</li>
                                        <li>Location: {event.event.chr} ({event.event.strand} strand) {positions.start} - {positions.end}</li>
                                    </ul>
                                </li>
                            {/each}
                        </ul>
                    </div>
                {/if}
            </div>
        {:else}
            <p>Loading… (may take up to a few minutes)</p>
        {/if}
    </div>
{/if}

<style>
    #splicing-detail-panel {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: var(--background-colour);
        padding: 20px;
        box-shadow: 0 0 10px rgba(0,0,0,0.5);
        z-index: 100;
        border-radius: 5px;
        max-width: 800px;
        width: 80%;
        height: 80%;
        overflow: auto;
    }
    
    .event-header {
        position: sticky;
        top: -20px;
        background-color: var(--background-colour);
        padding: 10px 0;
    }

    .close-button {
        position: sticky;
        top: -10px;
        left: 100%;
        border: none;
        background: none;
        font-size: 20px;
        cursor: pointer;
        z-index: 1000;
    }

    .info-divs {
        display: flex;
        justify-content: space-between;
    }

    .info-div {
        flex: 1;
        overflow: hidden;
    }

    .rna-seq {
        cursor: pointer;
        overflow: hidden;
        text-overflow: ellipsis;
    }
</style>