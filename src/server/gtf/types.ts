export interface GtfManifestFile {
  gtfs: GtfInfo[];
}

export interface GtfInfo {
  id: string;
  name: string;
  species?: string;
  assembly?: string;
  path: string; // workspace-relative path
  source?: "default" | "upload";
}

export interface GtfExon {
  start: number;
  end: number;
  exon_number?: number;
}

export interface GtfTranscript {
  transcript_id: string;
  transcript_name?: string;
  gene_id?: string;
  gene_name?: string;
  seq_region_name: string;
  strand: "+" | "-";
  exons: GtfExon[];
}

export interface GtfGeneModel {
  gtf: Pick<GtfInfo, "id" | "name" | "species" | "assembly" | "source">;
  gene: {
    gene_id?: string;
    gene_name?: string;
    seq_region_name?: string;
    strand?: "+" | "-";
  };
  transcripts: GtfTranscript[];
}
