export function getRandomColor(colourType: "hex" | "rgb" | "hsl" = "hex"): string {
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