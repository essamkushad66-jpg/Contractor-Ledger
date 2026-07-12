import { Hono } from "hono";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

type Env = {
  Variables: {
    userId: string
  },
  Bindings: {
    R2_BUCKET: R2Bucket,
    R2_ACCOUNT_ID: string,
    R2_ACCESS_KEY_ID: string,
    R2_SECRET_ACCESS_KEY: string
  }
}

const router = new Hono<Env>();

router.post("/storage/uploads/request-url", requireAuth, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = RequestUploadUrlBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Missing or invalid required fields" }, 400);
  }

  try {
    const { name, size, contentType } = parsed.data;

    const S3 = new S3Client({
      region: "auto",
      endpoint: `https://${c.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: c.env.R2_ACCESS_KEY_ID,
        secretAccessKey: c.env.R2_SECRET_ACCESS_KEY,
      },
    });

    const objectId = crypto.randomUUID();
    const objectPath = `/objects/uploads/${objectId}`;

    const uploadURL = await getSignedUrl(
      S3,
      new PutObjectCommand({
        Bucket: "contractor-ledger", // Arbitrary name for Cloudflare R2
        Key: `uploads/${objectId}`,
        ContentType: contentType,
      }),
      { expiresIn: 3600 }
    );

    return c.json(
      RequestUploadUrlResponse.parse({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      })
    );
  } catch (error) {
    return c.json({ error: "Failed to generate upload URL" }, 500);
  }
});

router.get("/storage/public-objects/*", async (c) => {
  const filePath = c.req.path.replace(/^.*\/storage\/public-objects\//, "public/");
  const object = await c.env.R2_BUCKET.get(filePath);

  if (!object) {
    return c.json({ error: "File not found" }, 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);

  return new Response(object.body as ReadableStream, {
    headers,
  });
});

router.get("/storage/objects/*", requireAuth, async (c) => {
  const filePath = c.req.path.replace(/^.*\/storage\/objects\//, "");
  const object = await c.env.R2_BUCKET.get(filePath);

  if (!object) {
    return c.json({ error: "Object not found" }, 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);

  return new Response(object.body as ReadableStream, {
    headers,
  });
});

export default router;
