import { readFile } from "node:fs/promises";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { IMAGE_DIR } from "../services/productImageService.js";

const SAFE_FILENAME = /^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp|gif|avif)$/;

const EXT_TO_CONTENT_TYPE: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
};

export async function imageRoutes(app: FastifyInstance) {
  app.get<{ Params: { filename: string } }>("/images/:filename", async (request, reply) => {
    const { filename } = request.params;
    if (!SAFE_FILENAME.test(filename)) return reply.code(404).send();

    try {
      const body = await readFile(path.join(IMAGE_DIR, filename));
      reply.header("Cache-Control", "public, max-age=31536000, immutable");
      reply.type(EXT_TO_CONTENT_TYPE[path.extname(filename).toLowerCase()] ?? "image/jpeg");
      return reply.send(body);
    } catch {
      return reply.code(404).send();
    }
  });
}
