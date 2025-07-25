<script lang="ts">
	import { onMount } from 'svelte';

	interface ThemeConfig {
		// Colors
		primaryColor: string;
		secondaryColor: string;
		backgroundColor: string;
		backgroundColorSecondary: string;
		backgroundColorTertiary: string;
		textColor: string;
		textColorSecondary: string;
		accentColor: string;
		borderColor: string;
		
		// Typography
		fontFamily: string;
		fontSize: string;
		fontWeight: string;
		lineHeight: string;
		
		// Spacing
		spacing: string;
		borderRadius: string;
		
		// Other
		shadowColor: string;
		linkColor: string;
		buttonColor: string;
	}

	// Font definitions with Google Fonts support
	const fontOptions = [
		{ name: 'Inconsolata (default)', value: 'Inconsolata, monospace', googleFont: 'Inconsolata:wght@200;300;400;500;600;700;800;900' },
		{ name: 'Inter', value: 'Inter, sans-serif', googleFont: 'Inter:wght@100;200;300;400;500;600;700;800;900' },
		{ name: 'Roboto', value: 'Roboto, sans-serif', googleFont: 'Roboto:wght@100;300;400;500;700;900' },
		{ name: 'Open Sans', value: 'Open Sans, sans-serif', googleFont: 'Open+Sans:wght@300;400;500;600;700;800' },
		{ name: 'Lato', value: 'Lato, sans-serif', googleFont: 'Lato:wght@100;300;400;700;900' },
		{ name: 'Poppins', value: 'Poppins, sans-serif', googleFont: 'Poppins:wght@100;200;300;400;500;600;700;800;900' },
		{ name: 'Source Sans Pro', value: 'Source Sans Pro, sans-serif', googleFont: 'Source+Sans+Pro:wght@200;300;400;600;700;900' },
		{ name: 'Nunito', value: 'Nunito, sans-serif', googleFont: 'Nunito:wght@200;300;400;500;600;700;800;900' },
		{ name: 'Montserrat', value: 'Montserrat, sans-serif', googleFont: 'Montserrat:wght@100;200;300;400;500;600;700;800;900' },
		{ name: 'Fira Code', value: 'Fira Code, monospace', googleFont: 'Fira+Code:wght@300;400;500;600;700' },
		{ name: 'JetBrains Mono', value: 'JetBrains Mono, monospace', googleFont: 'JetBrains+Mono:wght@100;200;300;400;500;600;700;800' },
		{ name: 'Source Code Pro', value: 'Source Code Pro, monospace', googleFont: 'Source+Code+Pro:wght@200;300;400;500;600;700;800;900' },
		{ name: 'Playfair Display', value: 'Playfair Display, serif', googleFont: 'Playfair+Display:wght@400;500;600;700;800;900' },
		{ name: 'Merriweather', value: 'Merriweather, serif', googleFont: 'Merriweather:wght@300;400;700;900' },
		{ name: 'Crimson Text', value: 'Crimson Text, serif', googleFont: 'Crimson+Text:wght@400;600;700' },
		{ name: 'Arial', value: 'Arial, sans-serif', googleFont: null },
		{ name: 'Georgia', value: 'Georgia, serif', googleFont: null },
		{ name: 'Courier New', value: 'Courier New, monospace', googleFont: null },
		{ name: 'Times New Roman', value: 'Times New Roman, serif', googleFont: null },
	];

	const defaultTheme: ThemeConfig = {
		primaryColor: '#2563eb',
		secondaryColor: '#64748b',
		backgroundColor: '#ffffff',
		backgroundColorSecondary: '#f8fafc',
		backgroundColorTertiary: '#e2e8f0',
		textColor: '#1e293b',
		textColorSecondary: '#64748b',
		accentColor: '#06b6d4',
		borderColor: '#e2e8f0',
		fontFamily: 'Inconsolata, monospace',
		fontSize: '14',
		fontWeight: '300',
		lineHeight: '1.5',
		spacing: '1',
		borderRadius: '6',
		shadowColor: 'rgba(0, 0, 0, 0.1)',
		linkColor: '#2563eb',
		buttonColor: '#2563eb'
	};

	const darkTheme: ThemeConfig = {
		primaryColor: '#3b82f6',
		secondaryColor: '#94a3b8',
		backgroundColor: '#0f172a',
		backgroundColorSecondary: '#1e293b',
		backgroundColorTertiary: '#334155',
		textColor: '#f8fafc',
		textColorSecondary: '#94a3b8',
		accentColor: '#06b6d4',
		borderColor: '#334155',
		fontFamily: 'Inconsolata, monospace',
		fontSize: '14',
		fontWeight: '300',
		lineHeight: '1.5',
		spacing: '1',
		borderRadius: '6',
		shadowColor: 'rgba(0, 0, 0, 0.3)',
		linkColor: '#60a5fa',
		buttonColor: '#3b82f6'
	};

	let currentTheme: ThemeConfig = { ...defaultTheme };
	let isExpanded = false;

	let loadedFonts = new Set<string>();

	onMount(() => {
		// Load saved theme from localStorage
		const saved = localStorage.getItem('custom-theme');
		if (saved) {
			try {
				currentTheme = { ...defaultTheme, ...JSON.parse(saved) };
			} catch (e) {
				console.warn('Failed to parse saved theme, using default');
			}
		}
		
		// Load the current font if it's a Google Font
		const currentFontOption = fontOptions.find(opt => opt.value === currentTheme.fontFamily);
		if (currentFontOption) {
			loadGoogleFont(currentFontOption);
		}
		
		applyTheme();
	});

	function applyTheme() {
		const root = document.documentElement;
		
		// Apply all custom properties
		root.style.setProperty('--primary-color', currentTheme.primaryColor);
		root.style.setProperty('--secondary-color', currentTheme.secondaryColor);
		root.style.setProperty('--background-colour', currentTheme.backgroundColor);
		root.style.setProperty('--background-colour-secondary', currentTheme.backgroundColorSecondary);
		root.style.setProperty('--background-colour-tertiary', currentTheme.backgroundColorTertiary);
		root.style.setProperty('--text-color', currentTheme.textColor);
		root.style.setProperty('--text-color-secondary', currentTheme.textColorSecondary);
		root.style.setProperty('--accent-color', currentTheme.accentColor);
		root.style.setProperty('--border-color', currentTheme.borderColor);
		root.style.setProperty('--font-family', currentTheme.fontFamily);
		root.style.setProperty('--font-size', currentTheme.fontSize + 'px');
		root.style.setProperty('--font-weight', currentTheme.fontWeight);
		root.style.setProperty('--line-height', currentTheme.lineHeight);
		root.style.setProperty('--spacing', currentTheme.spacing + 'rem');
		root.style.setProperty('--border-radius', currentTheme.borderRadius + 'px');
		root.style.setProperty('--shadow-color', currentTheme.shadowColor);
		root.style.setProperty('--link-color', currentTheme.linkColor);
		root.style.setProperty('--button-color', currentTheme.buttonColor);
		
		// Save to localStorage
		localStorage.setItem('custom-theme', JSON.stringify(currentTheme));
	}

	function handleThemeChange() {
		applyTheme();
	}

	function loadPreset(preset: 'light' | 'dark') {
		currentTheme = preset === 'dark' ? { ...darkTheme } : { ...defaultTheme };
		applyTheme();
	}

	function exportTheme() {
		const blob = new Blob([JSON.stringify(currentTheme, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'theme.json';
		a.click();
		URL.revokeObjectURL(url);
	}

	function importTheme(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			const reader = new FileReader();
			reader.onload = (e) => {
				try {
					const imported = JSON.parse(e.target?.result as string);
					currentTheme = { ...defaultTheme, ...imported };
					applyTheme();
				} catch (error) {
					alert('Invalid theme file');
				}
			};
			reader.readAsText(file);
		}
	}

	function loadGoogleFont(fontOption: typeof fontOptions[0]) {
		if (!fontOption.googleFont || loadedFonts.has(fontOption.googleFont)) {
			return;
		}

		// Check if font link already exists
		const existingLink = document.querySelector(`link[href*="${fontOption.googleFont}"]`);
		if (existingLink) {
			loadedFonts.add(fontOption.googleFont);
			return;
		}

		// Create and append Google Fonts link
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = `https://fonts.googleapis.com/css2?family=${fontOption.googleFont}&display=swap`;
		document.head.appendChild(link);
		
		loadedFonts.add(fontOption.googleFont);
	}

	function handleFontChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		const selectedOption = fontOptions.find(opt => opt.value === target.value);
		
		if (selectedOption) {
			loadGoogleFont(selectedOption);
			currentTheme.fontFamily = selectedOption.value;
			handleThemeChange();
		}
	}
</script>

<div class="theme-customizer">
	<button class="theme-toggle" on:click={() => isExpanded = !isExpanded}>
		🎨 Customize Theme
	</button>
	
	{#if isExpanded}
		<div class="theme-panel">
			<div class="theme-presets">
				<button on:click={() => loadPreset('light')}>Light Theme</button>
				<button on:click={() => loadPreset('dark')}>Dark Theme</button>
				<button on:click={exportTheme}>Export Theme</button>
				<label class="import-btn">
					Import Theme
					<input type="file" accept=".json" on:change={importTheme} style="display: none;">
				</label>
			</div>

			<div class="theme-sections">
				<details open>
					<summary>Colors</summary>
					<div class="controls-grid">
						<label>
							Primary Color:
							<input type="color" bind:value={currentTheme.primaryColor} on:input={handleThemeChange}>
						</label>
						<label>
							Secondary Color:
							<input type="color" bind:value={currentTheme.secondaryColor} on:input={handleThemeChange}>
						</label>
						<label>
							Background:
							<input type="color" bind:value={currentTheme.backgroundColor} on:input={handleThemeChange}>
						</label>
						<label>
							Background Secondary:
							<input type="color" bind:value={currentTheme.backgroundColorSecondary} on:input={handleThemeChange}>
						</label>
						<label>
							Background Tertiary:
							<input type="color" bind:value={currentTheme.backgroundColorTertiary} on:input={handleThemeChange}>
						</label>
						<label>
							Text Color:
							<input type="color" bind:value={currentTheme.textColor} on:input={handleThemeChange}>
						</label>
						<label>
							Text Secondary:
							<input type="color" bind:value={currentTheme.textColorSecondary} on:input={handleThemeChange}>
						</label>
						<label>
							Accent Color:
							<input type="color" bind:value={currentTheme.accentColor} on:input={handleThemeChange}>
						</label>
						<label>
							Border Color:
							<input type="color" bind:value={currentTheme.borderColor} on:input={handleThemeChange}>
						</label>
						<label>
							Link Color:
							<input type="color" bind:value={currentTheme.linkColor} on:input={handleThemeChange}>
						</label>
						<label>
							Button Color:
							<input type="color" bind:value={currentTheme.buttonColor} on:input={handleThemeChange}>
						</label>
					</div>
				</details>

				<details>
					<summary>Typography</summary>
					<div class="controls-grid">
						<label>
							Font Family:
							<select bind:value={currentTheme.fontFamily} on:change={handleFontChange}>
								{#each fontOptions as font}
									<option value={font.value}>{font.name}</option>
								{/each}
							</select>
						</label>
						<label>
							Font Size:
							<input type="range" min="10" max="24" value={currentTheme.fontSize} on:input={(e) => {
								const target = e.target as HTMLInputElement;
								currentTheme.fontSize = target.value;
								handleThemeChange();
							}}>
							<span>{currentTheme.fontSize}px</span>
						</label>
						<label>
							Font Weight:
							<select bind:value={currentTheme.fontWeight} on:change={handleThemeChange}>
								<option value="100">100 - Thin</option>
								<option value="200">200 - Extra Light</option>
								<option value="300">300 - Light</option>
								<option value="400">400 - Normal</option>
								<option value="500">500 - Medium</option>
								<option value="600">600 - Semi Bold</option>
								<option value="700">700 - Bold</option>
								<option value="800">800 - Extra Bold</option>
								<option value="900">900 - Black</option>
							</select>
						</label>
						<label>
							Line Height:
							<input type="range" min="1" max="2" step="0.1" value={currentTheme.lineHeight} on:input={(e) => {
								const target = e.target as HTMLInputElement;
								currentTheme.lineHeight = target.value;
								handleThemeChange();
							}}>
							<span>{currentTheme.lineHeight}</span>
						</label>
					</div>
				</details>

				<details>
					<summary>Layout & Spacing</summary>
					<div class="controls-grid">
						<label>
							Base Spacing:
							<input type="range" min="0.5" max="3" step="0.25" value={currentTheme.spacing} on:input={(e) => {
								const target = e.target as HTMLInputElement;
								currentTheme.spacing = target.value;
								handleThemeChange();
							}}>
							<span>{currentTheme.spacing}rem</span>
						</label>
						<label>
							Border Radius:
							<input type="range" min="0" max="20" value={currentTheme.borderRadius} on:input={(e) => {
								const target = e.target as HTMLInputElement;
								currentTheme.borderRadius = target.value;
								handleThemeChange();
							}}>
							<span>{currentTheme.borderRadius}px</span>
						</label>
					</div>
				</details>
			</div>
		</div>
	{/if}
</div>

<style>
	.theme-customizer {
		position: fixed;
		top: 20px;
		right: 20px;
		z-index: 1000;
	}

	.theme-toggle {
		background: var(--button-color, #2563eb);
		color: white;
		border: none;
		padding: 8px 16px;
		border-radius: var(--border-radius, 4px);
		cursor: pointer;
		font-size: 14px;
		box-shadow: 0 2px 4px var(--shadow-color, rgba(0,0,0,0.1));
	}

	.theme-toggle:hover {
		opacity: 0.9;
	}

	.theme-panel {
		position: absolute;
		top: 100%;
		right: 0;
		margin-top: 8px;
		background: var(--background-colour, white);
		border: 1px solid var(--border-color, #e0e0e0);
		border-radius: var(--border-radius, 4px);
		padding: 16px;
		box-shadow: 0 4px 12px var(--shadow-color, rgba(0,0,0,0.1));
		min-width: 350px;
		max-height: 70vh;
		overflow-y: auto;
		color: var(--text-color, black);
	}

	.theme-presets {
		display: flex;
		gap: 8px;
		margin-bottom: 16px;
		flex-wrap: wrap;
	}

	.theme-presets button,
	.import-btn {
		background: var(--background-colour-secondary, #f0f0f0);
		border: 1px solid var(--border-color, #e0e0e0);
		padding: 6px 12px;
		border-radius: var(--border-radius, 4px);
		cursor: pointer;
		font-size: 12px;
		color: var(--text-color, black);
	}

	.theme-presets button:hover,
	.import-btn:hover {
		background: var(--background-colour-tertiary, #e0e0e0);
	}

	.controls-grid {
		display: grid;
		gap: 12px;
		margin-top: 8px;
	}

	.controls-grid label {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 12px;
		color: var(--text-color, black);
	}

	.controls-grid input,
	.controls-grid select {
		flex: 1;
		padding: 4px 8px;
		border: 1px solid var(--border-color, #e0e0e0);
		border-radius: var(--border-radius, 4px);
		background: var(--background-colour, white);
		color: var(--text-color, black);
		font-size: 12px;
	}

	details {
		margin-bottom: 12px;
	}

	summary {
		cursor: pointer;
		font-weight: 600;
		padding: 8px 0;
		color: var(--text-color, black);
		border-bottom: 1px solid var(--border-color, #e0e0e0);
	}

	summary:hover {
		color: var(--primary-color, #2563eb);
	}
</style>