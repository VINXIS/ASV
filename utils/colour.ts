export function highlightColour(colour: string, brightness: number): string {
    if (colour.startsWith("#")) {
        // Parse the hex to RGB, then add brightness and convert back to hex
        const r = parseInt(colour.slice(1, 3), 16);
        const g = parseInt(colour.slice(3, 5), 16);
        const b = parseInt(colour.slice(5, 7), 16);
        
        const newR = Math.min(255, Math.max(0, r + brightness));
        const newG = Math.min(255, Math.max(0, g + brightness));
        const newB = Math.min(255, Math.max(0, b + brightness));
        
        return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
    }
    
    if (colour.startsWith("rgb")) {
        const rgbValues = colour.match(/\d+/g);
        if (!rgbValues || rgbValues.length < 3) return colour;
        
        const r = parseInt(rgbValues[0]);
        const g = parseInt(rgbValues[1]);
        const b = parseInt(rgbValues[2]);
        
        const newR = Math.min(255, Math.max(0, r + brightness));
        const newG = Math.min(255, Math.max(0, g + brightness));
        const newB = Math.min(255, Math.max(0, b + brightness));
        
        return `rgb(${newR}, ${newG}, ${newB})`;
    }
    
    if (colour.startsWith("hsl")) {
        const hslValues = colour.match(/\d+/g);
        if (!hslValues || hslValues.length < 3) return colour;
        
        const h = parseInt(hslValues[0]);
        const s = parseInt(hslValues[1]);
        const l = parseInt(hslValues[2]);
        
        // For HSL, we only increase lightness
        const newL = Math.min(100, Math.max(0, l + brightness));
        
        return `hsl(${h}, ${s}%, ${newL}%)`;
    }
    
    return colour;
}

export function getRandomColour(colourType: "hex" | "rgb" | "hsl" = "hex"): string {
    switch (colourType) {
        case "rgb":
            return `rgb(${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)})`;
        case "hsl":
            return `hsl(${Math.floor(Math.random() * 360)}, ${Math.floor(Math.random() * 100)}%, ${Math.floor(Math.random() * 100)}%)`;
        case "hex":
            return `#${Math.floor(Math.random() * 16777215).toString(16)}`;
        default:
            return `#${Math.floor(Math.random() * 16777215).toString(16)}`;
    }
}