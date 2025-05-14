
// Watches for :root class changes to update colors
export function rootObserver(callback: any) {
    const observer = new MutationObserver(() => {
        callback();
    });
    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
    });
}