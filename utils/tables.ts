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
    const rowVal = findValueInRow(row, headerMapping, headerName);
    const value = parseFloat(rowVal);
    if (isNaN(value)) {
        console.warn(`Value for header "${headerName}" is not a valid number: "${rowVal}"`);
        return NaN;
    }
    return value;
}

export function arrayToString(arr?: number[], inQuotes?: boolean): string {
    if (!arr) return "N/A";
    return arr.length > 0 ? inQuotes ? `"${arr.join(",")}"` : arr.join(",") : "N/A";
}