// This will not be an object later, in fact, this entire state should be done server-side later
export interface Feature {
    seqname: string;
    source: string;
    feature: string;
    start: number;
    end: number;
    score: string;
    strand: "+" | "-";
    frame: number;
    attributes: Record<string, string | number>;
    comment: string;
}

const targetfiles: Record<string, { filename: string; parts: number; }> = {
    hg38: { filename: "./hg38.ncbiRefSeq.gtf", parts: 8 },
};
let targetGTF = "hg38";

let featureList: Record<string, Feature[]> = {};
export const gtfEmitter = new EventTarget();

function parseGTFLine(line: string): Feature | null {
    const parts = line.trim().split('\t');
    if (parts.length < 9 || line.startsWith('#')) // Skip comments and malformed lines
        return null;

    const [seqname, source, feature, start, end, score, strand, frame, attributes] = parts;

    const attrObj: Record<string, string | number> = {};
    const attrPairs = attributes.split(';').map(attr => attr.trim()).filter(attr => attr);
    for (const pair of attrPairs) {
        const [key, value] = pair.split(' ');
        if (value) // Remove quotes from value if present
            attrObj[key] = value.replace(/"/g, '');
        else // If no value, just use the key
            attrObj[key] = key;

        if (!isNaN(parseFloat(attrObj[key] as string)))
            attrObj[key] = parseFloat(attrObj[key] as string);
    }
    
    return {
        seqname,
        source,
        feature,
        start: parseInt(start, 10),
        end: parseInt(end, 10),
        score,
        strand: strand as "+" | "-",
        frame: parseInt(frame, 10),
        attributes: attrObj,
        comment: '',
    };
}

function processGTFData(data: string, carryover: string = ""): string {
    // Combine any carryover with the new data
    const combinedData = carryover + data;
    const lines = combinedData.split('\n');
    
    // If the last line doesn't end with a newline, it might be incomplete
    // We'll return it as carryover for the next file
    const lastLine = lines.pop() || "";
    let nextCarryover = "";
    
    if (!data.endsWith('\n') && lastLine !== "")
        nextCarryover = lastLine;
    else // If the last line is complete, process it too
        parseGTFLine(lastLine);

    for (const line of lines) {
        const feature = parseGTFLine(line);
        if (feature) {
            const geneName = (feature.attributes['gene_name'] || feature.attributes['gene_id'] || 'unknown') as string;
            
            if (!featureList[geneName])
                featureList[geneName] = [];
            featureList[geneName].push(feature);
        }
    }
    
    return nextCarryover;
}

export async function parseGTF() {
    const gtfFiles = targetfiles[targetGTF];
    if (!gtfFiles) {
        console.error(`GTF file for ${targetGTF} not found.`);
        return;
    }
    
    try {
        let carryover = ""; // Store incomplete lines between files
        for (let i = 1; i <= gtfFiles.parts; i++) {
            const gtfFile = `${gtfFiles.filename}.part${i}`;
            
            const response = await fetch(gtfFile);
            if (!response.ok) {
                console.error(`Failed to fetch GTF file: ${gtfFile}`);
                continue; // Try next file instead of returning
            }
            
            const data = await response.text();
            carryover = processGTFData(data, carryover);
        }
        
        // Process any final carryover data
        if (carryover)
            processGTFData(carryover + "\n", ""); // Add newline to ensure it's processed
        
        gtfEmitter.dispatchEvent(new Event("update"));
        
    } catch (error) {
        console.error(`Error parsing GTF file: ${error}`);
    }
}

export function getFeaturesByGene(geneName: string): Feature[] {
    return featureList[geneName] || [];
}