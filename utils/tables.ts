export function createHeaderMapping(headers: string[]): Record<string, number> {
    const mapping: Record<string, number> = {};
    
    headers.forEach((header, index) => {
        if (header in mapping)
            return;
        mapping[header] = index;
    });
    
    return mapping;
}

export function findValueInRow(row: string[], headerMapping: Record<string, number>, headerName: string): string {
    const index = headerMapping[headerName];
    return index !== undefined ? row[index].replace(/"/g, "").trim() : "";
}

export function findNumberInRow(row: string[], headerMapping: Record<string, number>, headerName: string): number {
    const value = findValueInRow(row, headerMapping, headerName);
    return parseFloat(value) || NaN;
}