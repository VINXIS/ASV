<script lang="ts">
    import { type Strain, type ASSEvent, type MXEEvent, type RIEvent, type SEEvent, type ReadType, type EventType, type Event as ASEvent, getStrains, setStrains } from "./states/strains.svelte";
    import { average, parseNumberArray } from "../../utils/numbers";
    import { findValueInRow, findNumberInRow, createHeaderMapping } from "../../utils/tables";
    import { getRandomColour } from "../../utils/colour";
    import { readFileAsync } from "../../utils/files";

    let folderInput: HTMLInputElement;
    let isLoading = false;
    let errorMessage = "";
    let successMessage = "";
    
    // Regex patterns to identify file types
    const filePatterns = {
        JC: /\.(MATS\.JC\.txt)$/i,
        JCEC: /\.(MATS\.JCEC\.txt)$/i
    };

    function getReadType(filename: string): ReadType | null {
        if (filePatterns.JC.test(filename))
            return "JC";
        if (filePatterns.JCEC.test(filename))
            return "JCEC";
        return null;
    }

    function getEventType(filename: string): EventType | null {
        let eventMatch = filename.match(/^(A3SS|A5SS|MXE|RI|SE)\./i);
        if (eventMatch)
            return eventMatch[1].toUpperCase() as EventType;
        
        return null;
    }

    function processFileContent(filename: string, content: string): ASEvent[] | null {
        const readType = getReadType(filename);
        const eventType = getEventType(filename);
        
        if (!readType) {
            console.warn(`Could not determine read type for file: ${filename}`);
            return null;
        }

        if (!eventType) {
            console.warn(`Could not determine event type for file: ${filename}`);
            return null;
        }

        const lines = content.split("\n").filter(line => line.trim() !== "");
        if (lines.length <= 1)
            return null; // No data I guess
        
        const headers = lines[0].split("\t");
        const headerMapping = createHeaderMapping(headers); // Faster to use a map instead of searching for header index for each value for each row
        const events = [];
        
        for (let i = 1; i < lines.length; i++) {
            const row = lines[i].split("\t");
            
            try {
                const baseEvent: ASEvent = {
                    ID: findNumberInRow(row, headerMapping, "ID"),
                    geneID: findValueInRow(row, headerMapping, "GeneID"),
                    geneName: findValueInRow(row, headerMapping, "geneSymbol"),
                    chr: findValueInRow(row, headerMapping, "chr"),
                    strand: findValueInRow(row, headerMapping, "strand") as "+" | "-",
                    readType,
                    textWidth: 0, // Default value
                    
                    incCount1: parseNumberArray(findValueInRow(row, headerMapping, "IJC_SAMPLE_1")),
                    skipCount1: parseNumberArray(findValueInRow(row, headerMapping, "SJC_SAMPLE_1")),
                    incCount2: parseNumberArray(findValueInRow(row, headerMapping, "IJC_SAMPLE_2")),
                    skipCount2: parseNumberArray(findValueInRow(row, headerMapping, "SJC_SAMPLE_2")),

                    incCount1Avg: average(parseNumberArray(findValueInRow(row, headerMapping, "IJC_SAMPLE_1"))),
                    skipCount1Avg: average(parseNumberArray(findValueInRow(row, headerMapping, "SJC_SAMPLE_1"))),
                    incCount2Avg: average(parseNumberArray(findValueInRow(row, headerMapping, "IJC_SAMPLE_2"))),
                    skipCount2Avg: average(parseNumberArray(findValueInRow(row, headerMapping, "SJC_SAMPLE_2"))),

                    incFormLen: findNumberInRow(row, headerMapping, "IncFormLen"),
                    skipFormLen: findNumberInRow(row, headerMapping, "SkipFormLen"),
                    
                    pVal: findNumberInRow(row, headerMapping, "PValue"),
                    FDR: findNumberInRow(row, headerMapping, "FDR"),
                    
                    psi1: parseNumberArray(findValueInRow(row, headerMapping, "IncLevel1")),
                    psi2: parseNumberArray(findValueInRow(row, headerMapping, "IncLevel2")),
                    psi1Avg: average(parseNumberArray(findValueInRow(row, headerMapping, "IncLevel1"))),
                    psi2Avg: average(parseNumberArray(findValueInRow(row, headerMapping, "IncLevel2"))),
                    psiDiff: findNumberInRow(row, headerMapping, "IncLevelDifference"),
                    
                    eventType: eventType as EventType
                };
                
                // Add specific properties based on event type
                let specificEvent;
                
                switch (eventType) {
                    case "SE":
                        specificEvent = {
                            ...baseEvent,
                            exonStart: findNumberInRow(row, headerMapping, "exonStart_0base"),
                            exonEnd: findNumberInRow(row, headerMapping, "exonEnd"),
                            upstreamExonStart: findNumberInRow(row, headerMapping, "upstreamES"),
                            upstreamExonEnd: findNumberInRow(row, headerMapping, "upstreamEE"),
                            downstreamExonStart: findNumberInRow(row, headerMapping, "downstreamES"),
                            downstreamExonEnd: findNumberInRow(row, headerMapping, "downstreamEE"),
                            upstreamToTargetCount: parseNumberArray(findValueInRow(row, headerMapping, "upstream_to_target_count")),
                            targetCount: parseNumberArray(findValueInRow(row, headerMapping, "target_count")),
                            upstreamToDownstreamCount: parseNumberArray(findValueInRow(row, headerMapping, "upstream_to_downstream_count")),
                        } as SEEvent;
                        break;
                        
                    case "MXE":
                        specificEvent = {
                            ...baseEvent,
                            exon1Start: findNumberInRow(row, headerMapping, "1stExonStart_0base"),
                            exon1End: findNumberInRow(row, headerMapping, "1stExonEnd"),
                            exon2Start: findNumberInRow(row, headerMapping, "2ndExonStart_0base"),
                            exon2End: findNumberInRow(row, headerMapping, "2ndExonEnd"),
                            upstreamExonStart: findNumberInRow(row, headerMapping, "upstreamES"),
                            upstreamExonEnd: findNumberInRow(row, headerMapping, "upstreamEE"),
                            downstreamExonStart: findNumberInRow(row, headerMapping, "downstreamES"),
                            downstreamExonEnd: findNumberInRow(row, headerMapping, "downstreamEE"),
                            upstreamToFirstCount: parseNumberArray(findValueInRow(row, headerMapping, "upstream_to_first_count")),
                            firstToDownstreamCount: parseNumberArray(findValueInRow(row, headerMapping, "first_to_downstream_count")),
                            firstCount: parseNumberArray(findValueInRow(row, headerMapping, "first_count")),
                            upstreamToSecondCount: parseNumberArray(findValueInRow(row, headerMapping, "upstream_to_second_count")),
                            secondToDownstreamCount: parseNumberArray(findValueInRow(row, headerMapping, "second_to_downstream_count")),
                            secondCount: parseNumberArray(findValueInRow(row, headerMapping, "second_count")),
                        } as MXEEvent;
                        break;
                        
                    case "A3SS":
                    case "A5SS":
                        specificEvent = {
                            ...baseEvent,
                            longExonStart: findNumberInRow(row, headerMapping, "longExonStart_0base"),
                            longExonEnd: findNumberInRow(row, headerMapping, "longExonEnd"),
                            shortExonStart: findNumberInRow(row, headerMapping, "shortES"),
                            shortExonEnd: findNumberInRow(row, headerMapping, "shortEE"),
                            flankingExonStart: findNumberInRow(row, headerMapping, "flankingES"),
                            flankingExonEnd: findNumberInRow(row, headerMapping, "flankingEE"),
                            acrossShortBoundaryCount: parseNumberArray(findValueInRow(row, headerMapping, "across_short_boundary_count")),
                            longToFlankingCount: parseNumberArray(findValueInRow(row, headerMapping, "long_to_flanking_count")),
                            exclusiveToLongCount: parseNumberArray(findValueInRow(row, headerMapping, "exclusive_to_long_count")),
                            shortToFlankingCount: parseNumberArray(findValueInRow(row, headerMapping, "short_to_flanking_count")),
                        } as ASSEvent;
                        break;
                        
                    case "RI":
                        specificEvent = {
                            ...baseEvent,
                            riExonStart: findNumberInRow(row, headerMapping, "riExonStart_0base"),
                            riExonEnd: findNumberInRow(row, headerMapping, "riExonEnd"),
                            upstreamExonStart: findNumberInRow(row, headerMapping, "upstreamES"),
                            upstreamExonEnd: findNumberInRow(row, headerMapping, "upstreamEE"),
                            downstreamExonStart: findNumberInRow(row, headerMapping, "downstreamES"),
                            downstreamExonEnd: findNumberInRow(row, headerMapping, "downstreamEE"),
                            upstreamToIntronCount: parseNumberArray(findValueInRow(row, headerMapping, "upstream_to_intron_count")),
                            intronToDownstreamCount: parseNumberArray(findValueInRow(row, headerMapping, "intron_to_downstream_count")),
                            intronCount: parseNumberArray(findValueInRow(row, headerMapping, "intron_count")),
                            upstreamToDownstreamCount: parseNumberArray(findValueInRow(row, headerMapping, "upstream_to_downstream_count")),
                        } as RIEvent;
                        break;
                }
                
                events.push(specificEvent);
            } catch (e) {
                console.error(`Error processing line ${i} in file ${filename}:`, e);
                continue;
            }
        }
        
        return events;
    }
    
    async function handleFolderUpload(event: Event) {
        isLoading = true;
        errorMessage = "";
        successMessage = "";

        const newStrains: Strain[] = [];
        
        try {
            const files = (event.target as HTMLInputElement).files;
            if (!files || files.length === 0) {
                errorMessage = "No files selected";
                isLoading = false;
                return;
            }
            
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                
                // Skip files we don't care about
                if (!isRelevantFile(file.name))
                    continue;
                
                const fileContent = await readFileAsync(file);
                const strainName = inferStrainName(file.name);
                
                const events = processFileContent(file.name, fileContent);
                if (!events) {
                    console.warn(`No events found in file: ${file.name}`);
                    continue;
                }

                // Check if strain already exists
                const j = newStrains.findIndex(strain => strain.name === strainName);
                if (j !== -1) {
                    for (const event of events)
                        if (event.eventType)
                            newStrains[j][event.eventType].push(event as any);
                } else { // Create new strain
                    const newStrain: Strain = {
                        name: strainName,
                        colour: getRandomColour(),
                        visible: true,
                        A3SS: [],
                        A5SS: [],
                        MXE: [],
                        RI: [],
                        SE: [],
                    };
                    for (const event of events)
                        if (event.eventType)
                            newStrain[event.eventType].push(event as any);

                    newStrains.push(newStrain);
                }
            }

            // Check for duplicates between original and new strains, if there are any, confirm overwrite
            const originalStrains = getStrains();
            const duplicates = originalStrains.filter(originalStrain => 
                newStrains.some(newStrain => originalStrain.name === newStrain.name)
            );
            if (duplicates.length > 0) {
                const overwrite = confirm(`The following strains already exist and will be overwritten:\n${duplicates.map(strain => `${strain.name}`).join('\n')}\n\nDo you want to proceed?`);
                if (!overwrite) {
                    isLoading = false;
                    return;
                }

                // Remove duplicates from old strains
                for (const duplicate of duplicates) {
                    const index = originalStrains.findIndex(strain => strain.name === duplicate.name);
                    if (index !== -1)
                        originalStrains.splice(index, 1);
                }
            }
            
            setStrains([
                ...originalStrains,
                ...newStrains
            ]);

            successMessage = `Successfully loaded ${newStrains.length} strain(s)`;
            folderInput.value = "";
        } catch (e) {
            if (e instanceof Error) {
                console.error("Error processing folder:", e);
                errorMessage = `Error processing files: ${e.message}`;
            }
        }
        
        isLoading = false;
    }

    function isRelevantFile(filename: string): boolean {
        const basename = filename.split('/').pop() || filename;
        return (
            filePatterns.JC.test(basename) ||
            filePatterns.JCEC.test(basename)
        );
    }
    
    function inferStrainName(filename: string): string {
        const basename = filename.split('/').pop() || filename;
        
        // Try to extract strain name from common patterns
        // For example, "strain1_A3SS.MATS.JC.txt" -> "strain1"
        const match = basename.match(/^([^_]+)_[A-Z0-9]+\.(MATS\.(JC|JCEC)|fromGTF)/i);
        if (match) return match[1];
        
        // If no specific pattern, extract from folder name or use the full filename
        const folderName = folderInput.files?.[0]?.webkitRelativePath.split('/')[0];
        if (folderName)
            return folderName;
        
        // Fallback
        return "Unknown_Strain";
    }
</script>

<div class="rmats-uploader">

    {#if getStrains().length === 0}
        <h2>Upload rMATS Data</h2>
        <div class="upload-option">
            <h3>Upload folder</h3>
            <p>Select the folder containing the .txt files output by rMATS</p>
            <input
                style="display: none;"
                type="file" 
                name="folder" 
                webkitdirectory 
                multiple
                bind:this={folderInput}
                on:change={handleFolderUpload}
            />
            <button on:click={() => folderInput.click()}>Add Folder</button>
        </div>
    {:else}
        <!-- Smaller upload component -->
        <div class="upload-option">
            <p>Select another folder to add more strains/data</p>
            <input
                style="display: none;"
                type="file" 
                name="folder" 
                webkitdirectory 
                multiple
                bind:this={folderInput}
                on:change={handleFolderUpload}
            />
            <button on:click={() => folderInput.click()}>Add Folder</button>
        </div>
    {/if}
    
    {#if isLoading}
        <div class="status loading">
            <p>Loading and processing data, please wait...</p>
        </div>
    {/if}
    
    {#if errorMessage}
        <div class="status error">
            <p>{errorMessage}</p>
        </div>
    {/if}
    
    {#if successMessage}
        <div class="status success">
            <p>{successMessage}</p>
        </div>
    {/if}

    {#if getStrains().length > 0}
        <h3>Loaded Strains:</h3>
        <ul>
            {#each getStrains() as strain}
                {#if strain.visible}
                    <li>{strain.name}</li>
                {:else}
                    <li style="text-decoration: line-through;">{strain.name}</li>
                {/if}
            {/each}
        </ul>
    {/if}

    {#if getStrains().length > 0}
        <div class="info">
            <h3>Files Currently Parsed:</h3>
            <ul>
                <li><code>[AS_Event].MATS.JC.txt</code> - Junction counts only</li>
                <li><code>[AS_Event].MATS.JCEC.txt</code> - Junction counts and exon body reads</li>
            </ul>
            <p>Where <code>[AS_Event]</code> is one of: A3SS, A5SS, MXE, RI, SE</p>
        </div>
    {/if}
</div>

<style>
    .rmats-uploader {
        max-width: 800px;
        margin: 0 auto;
        padding: 1em;
    }
    
    .upload-option {
        min-width: 300px;
        padding: 1em;
        border: 1px solid #ccc;
        border-radius: 8px;
    }
    
    .status {
        margin: 1em 0;
        padding: 0.5em 1em;
        border-radius: 4px;
    }
    
    .loading {
        background-color: #ccccff;
        color: #000088;
    }
    
    .error {
        background-color: #ffcccc;
        color: #880000;
    }
    
    .success {
        background-color: #ccffcc;
        color: #008800;
    }
    
    .info {
        margin-top: 2em;
        border-radius: 8px;
    }
    
    code {
        font-family: monospace;
        padding: 2px 4px;
        border-radius: 3px;
    }
</style>