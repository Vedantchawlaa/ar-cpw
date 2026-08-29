// Best-effort fallback parser for measurement PDFs that don't carry the
// app's own embedded CPW_DATA marker (e.g. re-exported, WhatsApp-compressed,
// or otherwise stripped of metadata). Reconstructs floors/rooms/items by
// pattern-matching the plain text layout this app's own PDF generator
// produces (see generatePDF in MeasurementList.tsx) - it is not a general
// PDF-table parser and will not understand unrelated PDF layouts.

interface ParsedItem {
    id: string;
    name: string;
    type: "Curtain" | "Blind";
    width?: string;
    height?: string;
    quantity?: string;
    sheerQuantity?: string;
    sheerRequired?: boolean;
    fabricRequired?: string;
    sheerFabricRequired?: string;
    trackSize?: string;
    sheerTrackSize?: string;
    sqft?: string;
    mountType?: "Ceiling" | "Wall";
    curtainType?: "Pinch Pleat" | "Ripple Fold";
    tiesRequired?: boolean;
    remarks?: string;
}

interface ParsedRoom {
    id: string;
    name: string;
    items: ParsedItem[];
}

interface ParsedFloor {
    id: string;
    name: string;
    rooms: ParsedRoom[];
}

const genId = () => Math.random().toString(36).substring(2, 11);

const HEADER_RE = /^Window\s+Type\s+/i;
const ROW_START_RE = /^(.+?)\s+(Curtain|Blind)\s+(?:(\d+(?:\.\d+)?\s*x\s*\d+(?:\.\d+)?)\s+)?(\d+(?:\.\d+)?(?:\+\d+(?:\.\d+)?)?)\s+(.*)$/;
const PAGE_MARKER_RE = /^--\s*\d+\s*of\s*\d+\s*--$/i;

function isBoundary(line: string): boolean {
    return (
        ROW_START_RE.test(line) ||
        HEADER_RE.test(line) ||
        /^Room Total/i.test(line) ||
        /^GRAND TOTAL/i.test(line) ||
        /^GENERAL NOTES/i.test(line) ||
        /-\s*Images:$/i.test(line)
    );
}

function ftInToInches(ft: string, inch?: string): string {
    return (parseFloat(ft) * 12 + (inch ? parseFloat(inch) : 0)).toString();
}

export async function parseMeasurementPdfText(buffer: Buffer): Promise<{
    floors: ParsedFloor[];
    itemCount: number;
    warnings: string[];
}> {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    let text: string;
    try {
        const result = await parser.getText();
        text = result.text;
    } finally {
        await parser.destroy();
    }

    const lines = text
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !PAGE_MARKER_RE.test(l));

    const floors: ParsedFloor[] = [];
    const warnings: string[] = [];
    let itemCount = 0;

    let currentFloor: ParsedFloor | null = null;
    let currentRoom: ParsedRoom | null = null;
    let pendingLabels: string[] = [];

    let i = 0;
    while (i < lines.length) {
        const line = lines[i];

        if (/^GRAND TOTAL/i.test(line) || /^GENERAL NOTES/i.test(line)) {
            break;
        }

        if (/^Room Total/i.test(line) || /-\s*Images:$/i.test(line)) {
            i++;
            continue;
        }

        if (HEADER_RE.test(line)) {
            if (pendingLabels.length >= 2) {
                currentFloor = { id: genId(), name: pendingLabels[pendingLabels.length - 2], rooms: [] };
                floors.push(currentFloor);
                currentRoom = { id: genId(), name: pendingLabels[pendingLabels.length - 1], items: [] };
                currentFloor.rooms.push(currentRoom);
            } else if (pendingLabels.length === 1) {
                if (!currentFloor) {
                    currentFloor = { id: genId(), name: "Floor 1", rooms: [] };
                    floors.push(currentFloor);
                    warnings.push('Could not determine a floor name for one or more rooms; grouped under "Floor 1".');
                }
                currentRoom = { id: genId(), name: pendingLabels[0], items: [] };
                currentFloor.rooms.push(currentRoom);
            } else {
                if (!currentFloor) {
                    currentFloor = { id: genId(), name: "Floor 1", rooms: [] };
                    floors.push(currentFloor);
                }
                currentRoom = { id: genId(), name: `Room ${currentFloor.rooms.length + 1}`, items: [] };
                currentFloor.rooms.push(currentRoom);
                warnings.push("Found a table without a preceding room label; used a generic room name.");
            }
            pendingLabels = [];
            i++;
            continue;
        }

        const rowMatch = line.match(ROW_START_RE);
        if (rowMatch && currentRoom) {
            const [, rawName, type, wh, qtyToken, restFirstLine] = rowMatch;

            const block: string[] = restFirstLine ? [restFirstLine] : [];
            let j = i + 1;
            while (j < lines.length && !isBoundary(lines[j])) {
                block.push(lines[j]);
                j++;
            }
            const blockText = block.join("\n");

            const item: ParsedItem = { id: genId(), name: rawName.trim(), type: type as "Curtain" | "Blind" };

            if (wh) {
                const whMatch = wh.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/);
                if (whMatch) {
                    item.width = whMatch[1];
                    item.height = whMatch[2];
                }
            }

            if (type === "Curtain") {
                const qtyParts = qtyToken.split("+");
                item.quantity = qtyParts[0];
                if (qtyParts[1]) {
                    item.sheerQuantity = qtyParts[1];
                    item.sheerRequired = true;
                }

                const meterMatches = [...blockText.matchAll(/(\d+(?:\.\d+)?)m\b/g)];
                if (meterMatches[0]) item.fabricRequired = meterMatches[0][1];
                if (meterMatches[1]) {
                    item.sheerFabricRequired = meterMatches[1][1];
                    item.sheerRequired = true;
                }

                const ftMatches = [...blockText.matchAll(/(\d+(?:\.\d+)?)ft(?:\s*(\d+)in)?/gi)];
                if (ftMatches[0]) item.trackSize = ftInToInches(ftMatches[0][1], ftMatches[0][2]);
                if (ftMatches[1]) item.sheerTrackSize = ftInToInches(ftMatches[1][1], ftMatches[1][2]);

                const mountMatch = blockText.match(/Mount:\s*(Ceiling|Wall)/i);
                if (mountMatch) item.mountType = mountMatch[1] as "Ceiling" | "Wall";
                const styleMatch = blockText.match(/Style:\s*(Pinch Pleat|Ripple Fold)/i);
                if (styleMatch) item.curtainType = styleMatch[1] as "Pinch Pleat" | "Ripple Fold";
                const tiesMatch = blockText.match(/Ties:\s*(Yes|No)/i);
                if (tiesMatch) item.tiesRequired = tiesMatch[1].toLowerCase() === "yes";
            } else {
                item.sqft = qtyToken;
            }

            const remainderText = blockText
                .replace(/Main:.*?\d+(?:\.\d+)?(?:m|ft|in).*?(?=\n|$)/gi, "")
                .replace(/Sheer:.*?\d+(?:\.\d+)?(?:m|ft|in).*?(?=\n|$)/gi, "")
                .replace(/Mount:\s*(Ceiling|Wall)/i, "")
                .replace(/Style:\s*(Pinch Pleat|Ripple Fold)/i, "")
                .replace(/Ties:\s*(Yes|No)/i, "")
                .replace(/Blind\s*-\s*\d+(?:\.\d+)?sf/i, "")
                .split("\n")
                .map((l) => l.trim())
                .filter(Boolean)
                .join(" ")
                .trim();
            if (remainderText) item.remarks = remainderText;

            currentRoom.items.push(item);
            itemCount++;
            i = j;
            continue;
        }

        // Not a table row or header - a short standalone line between tables
        // is a floor or room name label.
        if (line.length > 0 && line.length < 60) {
            pendingLabels.push(line);
        }
        i++;
    }

    if (floors.length === 0) {
        warnings.push("Could not find any recognizable measurement table in this PDF.");
    }

    return { floors, itemCount, warnings };
}
