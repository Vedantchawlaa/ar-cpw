import db from "@/lib/db";

/** Stores an uploaded file in the Attachment table and returns its serving URL. */
export async function saveAttachment(file: File) {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const attachment = await db.attachment.create({
        data: {
            filename: file.name,
            mimeType: file.type || "application/octet-stream",
            data: buffer,
        },
    });

    return { id: attachment.id, url: `/api/files/${attachment.id}` };
}
