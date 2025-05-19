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
export async function parseGTF() {
    const gtfFiles = targetfiles[targetGTF];
    if (!gtfFiles) {
        console.error(`GTF file for ${targetGTF} not found.`);
        return;
    }
    
    try {
        let text = "";
        for (let i = 1; i <= gtfFiles.parts; i++) {
            const gtfFile = `${gtfFiles.filename}.part${i}`;
            const response = await fetch(gtfFile);
            if (!response.ok) {
                console.error(`Failed to fetch GTF file: ${gtfFile}`);
                return;
            }
            const data = await response.text();
            text += data;
        }
        const lines = text.split('\n');

        const featureSet = new Set<string>();

        for (const line of lines) {
            const parts = line.trim().split('\t');
            if (parts.length < 9 || line.startsWith('#')) // Skip comments and malformed lines
                continue;

            const [seqname, source, feature, start, end, score, strand, frame, attributes] = parts;

            featureSet.add(feature);

            const attrObj: Record<string, string | number> = {};
            const attrPairs = attributes.split(';').map(attr => attr.trim()).filter(attr => attr);
            for (const pair of attrPairs) {
                const [key, value] = pair.split(' ');
                if (value) // Remove quotes from value if present
                    attrObj[key] = value.replace(/"/g, '');
                else // If no value, just use the key
                    attrObj[key] = key;

                if (!isNaN(parseFloat(attrObj[key])))
                    attrObj[key] = parseFloat(attrObj[key]); // Convert numeric values to numbers
            }
            const featureObj: Feature = {
                seqname,
                source,
                feature,
                start: parseInt(start, 10),
                end: parseInt(end, 10),
                score,
                strand: strand as "+" | "-",
                frame: parseInt(frame, 10),
                attributes: attrObj,
                comment: '', // Placeholder for comments if needed
            };
            const geneName = (featureObj.attributes['gene_name'] || featureObj.attributes['gene_id'] || 'unknown') as string;
            if (!featureList[geneName])
                featureList[geneName] = [];
            featureList[geneName].push(featureObj);
        }
        gtfEmitter.dispatchEvent(new Event("update"));
    } catch (error) {
        console.error(`Error parsing GTF file: ${error}`);
    }
}

export function getFeaturesByGene(geneName: string): Feature[] {
    return featureList[geneName] || [];
}
