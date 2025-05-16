let violinStrains = $state<Record<string, { min: number; max: number; values: number[] }>>({});
export function addViolinValues(key: string, values: number[]) {
    if (!violinStrains[key])
        violinStrains[key] = { min: Infinity, max: -Infinity, values: [] };
    violinStrains[key].values.push(...values);
    violinStrains[key].min = Math.min(violinStrains[key].min, ...values);
    violinStrains[key].max = Math.max(violinStrains[key].max, ...values);
}
export function getViolinValues(key: string) {
    return violinStrains[key] ?? { min: Infinity, max: -Infinity, values: [] };
}