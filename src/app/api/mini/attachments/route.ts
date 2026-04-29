import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getActiveOrgId } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { writeFile } from "fs/promises";
import { join } from "path";
import crypto from "crypto";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const entryId = form.get("entryId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Use JPG, PNG, or WebP." },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File too large. Max 5MB." },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop() ?? "jpg";
    const hash = crypto.randomBytes(8).toString("hex");
    const filename = `${hash}.${ext}`;
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadDir = join(process.cwd(), "public", "uploads");
    const filepath = join(uploadDir, filename);
    await writeFile(filepath, buffer);

    const url = `/uploads/${filename}`;

    // Save metadata to DB if entryId provided
    let attachmentId: string | undefined;
    if (entryId) {
      const rec = await db.journalEntryAttachment.create({
        data: {
          entryId,
          url,
          filename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          uploadedById: session.user.id,
        },
      });
      attachmentId = rec.id;
    }

    await logAudit({
      organizationId: getActiveOrgId(session) ?? "",
      userId: session.user.id,
      userName: session.user.name ?? undefined,
      action: "attachment.upload",
      entity: "journal_entry_attachment",
      entityId: attachmentId,
      details: { entryId, filename: file.name, size: file.size },
    });

    return NextResponse.json({ url, filename: file.name, size: file.size });
  } catch (err) {
    console.error("[mini/attachments] upload error:", err);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
