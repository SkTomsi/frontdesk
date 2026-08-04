import {
	DeleteObjectCommand,
	GetObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";

export interface R2Config {
	accountId: string;
	accessKeyId: string;
	secretAccessKey: string;
	bucket: string;
	endpoint?: string;
}

export interface R2Storage {
	uploadObject(
		key: string,
		body: Uint8Array | ArrayBuffer,
		contentType?: string,
	): Promise<void>;
	getObject(key: string): Promise<Uint8Array>;
	deleteObject(key: string): Promise<void>;
}

export function objectKey(tenantId: string, contentHash: string): string {
	return `tenants/${tenantId}/${contentHash}.pdf`;
}

export function createR2(config: R2Config): R2Storage {
	const endpoint =
		config.endpoint ?? `https://${config.accountId}.r2.cloudflarestorage.com`;

	const client = new S3Client({
		region: "auto",
		endpoint,
		credentials: {
			accessKeyId: config.accessKeyId,
			secretAccessKey: config.secretAccessKey,
		},
	});

	return {
		async uploadObject(key, body, contentType) {
			const input = body instanceof ArrayBuffer ? new Uint8Array(body) : body;
			await client.send(
				new PutObjectCommand({
					Bucket: config.bucket,
					Key: key,
					Body: input,
					ContentType: contentType,
				}),
			);
		},

		async getObject(key) {
			const result = await client.send(
				new GetObjectCommand({ Bucket: config.bucket, Key: key }),
			);
			if (!result.Body) {
				throw new Error(`Object "${key}" has no body`);
			}
			return result.Body.transformToByteArray();
		},

		async deleteObject(key) {
			await client.send(
				new DeleteObjectCommand({ Bucket: config.bucket, Key: key }),
			);
		},
	};
}

export function createR2FromEnv(): R2Storage {
	const accountId = process.env.R2_ACCOUNT_ID;
	const accessKeyId = process.env.R2_ACCESS_KEY_ID;
	const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
	const bucket = process.env.R2_BUCKET;

	if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
		throw new Error(
			"R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET are required",
		);
	}

	return createR2({ accountId, accessKeyId, secretAccessKey, bucket });
}
