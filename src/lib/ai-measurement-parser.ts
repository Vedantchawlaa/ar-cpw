import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const WindowSchema = z.object({
    name: z.string().describe("Short label for this window/curtain/blind, e.g. 'Window 1' or a description from the source (door, T-Door, etc.)"),
    type: z.enum(["Curtain", "Blind"]).describe("Default to Curtain unless the source clearly indicates a blind/shade"),
    width: z.number().describe("Width in inches. Convert from other units (cm, mm, ft) if needed."),
    height: z.number().describe("Height in inches. Convert from other units (cm, mm, ft) if needed."),
    notes: z.string().optional().describe("Anything from the source row that doesn't fit width/height/type/name - e.g. 'Single'/'Double' panel, fabric notes, style"),
});

const RoomSchema = z.object({
    roomName: z.string().describe("Room or location name this window belongs to, e.g. 'Drawing Room', 'Bedroom 1'"),
    windows: z.array(WindowSchema),
});

const ExtractionSchema = z.object({
    rooms: z.array(RoomSchema),
    unitNoteIfAny: z.string().optional().describe("Note if the source used non-inch units and you converted them"),
});

export type AiExtractedRoom = z.infer<typeof RoomSchema>;

const genId = () => Math.random().toString(36).substring(2, 11);

export async function parseMeasurementDocumentWithAi(
    buffer: Buffer,
    mimeType: string
): Promise<{
    floors: { id: string; name: string; rooms: { id: string; name: string; items: any[] }[] }[];
    itemCount: number;
    unitNote?: string;
}> {
    const client = new Anthropic();
    const base64 = buffer.toString("base64");

    const isPdf = mimeType === "application/pdf";
    const contentBlock: Anthropic.Messages.ContentBlockParam = isPdf
        ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
        : { type: "image", source: { type: "base64", media_type: mimeType as any, data: base64 } };

    const response = await client.messages.parse({
        model: "claude-opus-5",
        max_tokens: 16000,
        messages: [
            {
                role: "user",
                content: [
                    contentBlock,
                    {
                        type: "text",
                        text: "This is a curtain/blind measurement sheet (a table listing rooms/windows with widths and heights, in some layout - column names and structure vary by source). Extract every window/door/opening entry into the schema: group rows by room/location name, and for each entry capture its width and height (converted to inches if given in another unit), and whether it's a Curtain or Blind (default Curtain). Put any extra info that doesn't fit (like 'Single'/'Double', fabric, or style notes) into the notes field. Ignore header rows and any 'Total' row at the bottom.",
                    },
                ],
            },
        ],
        output_config: {
            format: zodOutputFormat(ExtractionSchema),
        },
    });

    const parsed = response.parsed_output;
    if (!parsed) {
        return { floors: [], itemCount: 0 };
    }

    let itemCount = 0;
    const floor = {
        id: genId(),
        name: "Floor 1",
        rooms: parsed.rooms.map((room) => {
            itemCount += room.windows.length;
            return {
                id: genId(),
                name: room.roomName || "Room",
                items: room.windows.map((w) => ({
                    id: genId(),
                    name: w.name || "Window",
                    type: w.type,
                    width: w.width.toString(),
                    height: w.height.toString(),
                    remarks: w.notes || "",
                })),
            };
        }),
    };

    return {
        floors: parsed.rooms.length > 0 ? [floor] : [],
        itemCount,
        unitNote: parsed.unitNoteIfAny,
    };
}
