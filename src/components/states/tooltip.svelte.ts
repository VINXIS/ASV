let tooltipHTML: string | null = $state(null);
export const updatedTooltipHTML = new EventTarget();
export function getTooltipHTML() {
    return tooltipHTML;
}
export function setTooltipHTML(html: string) {
    tooltipHTML = html;
    updatedTooltipHTML.dispatchEvent(new Event("update"));
}
export function clearTooltip() {
    tooltipHTML = null;
    updatedTooltipHTML.dispatchEvent(new Event("update"));
}
