export function average(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

export function parseNumberArray(input: string): number[] {
    if (!input || input.trim() === '') return [];
    return input.split(',').filter(val => !isNaN(parseFloat(val.trim()))).map(val => parseFloat(val.trim()));
}
