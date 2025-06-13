import { settings } from "./settings";

export const biotypeSortOrder: Record<string, number> = {
    "protein_coding": 1,
    "protein_coding_LoF": 2,
    "protein_coding_CDS_not_defined": 3,
    "processed_transcript": 4,
    "retained_intron": 5,
    "lncRNA": 6,
    "other": 7,
    "TEC": 8,
}

export interface EnsemblSpecies {
    name: string;
    display_name: string;
    common_name: string;
    assembly: string;
}

export interface SymbolLookup {
    species: string;
    source: string;
    id: string;
    Transcript: Transcript[];
    db_type: string;
    object_type: string;
    seq_region_name: string;
    display_name: string;
    version: number;
    strand: 1 | -1;
    logic_name: string;
    biotype: string;
    canonical_transcript: string;
    description: string;
    assembly_name: string;
    start: number;
    end: number;
}

export interface Transcript {
    gencode_primary: number;
    biotype: string;
    logic_name: string;
    strand: number;
    end: number;
    Exon: Exon[];
    start: number;
    assembly_name: string;
    length: number;
    db_type: string;
    object_type: string;
    id: string;
    species: string;
    source: string;
    version: number;
    Translation?: Translation;
    Parent: string;
    is_canonical: number;
    display_name: string;
    seq_region_name: string;
}

export interface Exon {
    end: number;
    version: number;
    start: number;
    assembly_name: string;
    seq_region_name: string;
    object_type: string;
    db_type: string;
    id: string;
    strand: number;
    species: string;
}

export interface Translation {
    version: number;
    end: number;
    start: number;
    Parent: string;
    length: number;
    object_type: string;
    db_type: string;
    id: string;
    species: string;
}

const cache: {
    sequences: Record<string, string>;
    geneInfos: Record<string, SymbolLookup>;
} = {
    sequences: {},
    geneInfos: {},
};

function getReq<T>(url: string) {
    return fetch(url)
    .then((response) => {
        if (!response.ok)
            throw new Error(`HTTP error! status: ${response.status}\n${response.statusText}\nURL: ${url}`);
        return response.json() as Promise<T>;
    });
}

function getEnsemblReq<T>(url: string): Promise<T> {
    const baseURL = 'https://rest.ensembl.org/';
    return getReq<T>(baseURL + url);
}

export function getSequenceRegion(
    chromosome: string,
    start: number,
    end: number,
    strand: 1 | -1,
): Promise<string> {
    const urlPath = 'sequence/region';

    const chromosomeFormatted = chromosome.replace('chr', '');
    const url = `${urlPath}/${settings.selectedSpecies}/${chromosomeFormatted}:${start}-${end}:${strand}?content-type=application/json`;
    
    if (cache.sequences[url])
        return Promise.resolve(cache.sequences[url]);

    return getEnsemblReq<{ seq: string } | { error: string }>(url)
    .then((data) => {
        if ('seq' in data) {
            cache.sequences[url] = data.seq;
            return data.seq;
        } else if ('error' in data)
            throw new Error(data.error);
        else
            throw new Error('Unexpected response format');
    })
    .catch((error) => {
        console.error('Error fetching sequence region:', error);
        throw error;
    });
}

export function getGeneInfo(geneId: string): Promise<SymbolLookup> {
    const urlPath = 'lookup/symbol';
    const url = `${urlPath}/${settings.selectedSpecies}/${geneId}?expand=1;content-type=application/json`;

    if (cache.geneInfos[url])
        return Promise.resolve(cache.geneInfos[url]);

    return getEnsemblReq<SymbolLookup | { error: string }>(url)
    .then((data) => {
        if ('error' in data)
            throw new Error(data.error);
        else if ('species' in data && 'id' in data) {
            data.Transcript.sort((a, b) => {
                if (a.is_canonical) return -1;
                if (b.is_canonical) return 1;
                
                if (a.gencode_primary === 1 && b.gencode_primary !== 1) return -1;
                if (b.gencode_primary === 1 && a.gencode_primary !== 1) return 1;
                
                const orderA = biotypeSortOrder[a.biotype] || biotypeSortOrder["other"];
                const orderB = biotypeSortOrder[b.biotype] || biotypeSortOrder["other"];
                if (orderA !== orderB) return orderA - orderB;

                const lengthA = a.Translation?.length || a.Exon.reduce((sum, exon) => sum + (exon.end - exon.start + 1), 0);
                const lengthB = b.Translation?.length || b.Exon.reduce((sum, exon) => sum + (exon.end - exon.start + 1), 0);
                return lengthB - lengthA;
            });
            // Ok so basically this was really because NCBI removes the stop codon from the CDS region, while Ensembl does not, and for now I am going to just keep the stop codons
            // // For each transcript, if strand if 1, subtract 3 from end in translation. If strand is -1, add 3 to start in translation
            // // This is after empirically comparing the CDS regions between Ensembl and NCBI, and finding that Ensembl's CDS regions are shifted by 3 bases.
            // data.Transcript.forEach((transcript) => {
            //     if (transcript.Translation) {
            //         if (transcript.strand === 1)
            //             transcript.Translation.end -= 3;
            //         else if (transcript.strand === -1)
            //             transcript.Translation.start += 3;
            //     }
            // });
            cache.geneInfos[url] = data;
            return data;
        } else
            throw new Error('Unexpected response format');
    })
    .catch((error) => {
        console.error('Error fetching gene info:', error);
        throw error;
    });
}

export function getSpeciesList(): Promise<EnsemblSpecies[]> {
    const urlPath = 'info/species?content-type=application/json';
    return getEnsemblReq<{ species: EnsemblSpecies[] }>(urlPath)
    .then((data) => {
        if (Array.isArray(data.species))
            return data.species;
        else
            throw new Error('Unexpected response format');
    })
    .catch((error) => {
        console.error('Error fetching species list:', error);
        throw error;
    });
}