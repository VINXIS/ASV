export function readFileAsync(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = (e) => reject(new Error(`Error reading file: ${e}`));
        reader.readAsText(file);
    });
}