import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fail } from './errors.js';

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

export async function savePhoto(base64: string | undefined): Promise<string> {
  if (!base64) return '';
  const root = process.env.FILES_ROOT;
  if (!root) fail('CONFIGURATION_ERROR', 'FILES_ROOT is required when a customer photo is supplied');
  const match = /^data:image\/(jpeg|jpg|png);base64,([A-Za-z\d+/]+={0,2})$/.exec(base64);
  if (!match) fail('VALIDATION_ERROR', 'Photo must be a base64 jpg, jpeg, or png image');
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > MAX_PHOTO_BYTES) fail('VALIDATION_ERROR', 'Photo exceeds the 10 MiB limit');
  const extension = match[1] === 'png' ? 'png' : 'jpg';
  const validSignature = extension === 'png'
    ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
  if (!validSignature) fail('VALIDATION_ERROR', 'Photo content does not match its image type');
  const absoluteRoot = path.resolve(root);
  await mkdir(absoluteRoot, { recursive: true, mode: 0o700 });
  const filename = `${randomUUID()}.${extension}`;
  const destination = path.resolve(absoluteRoot, filename);
  if (!destination.startsWith(`${absoluteRoot}${path.sep}`)) fail('VALIDATION_ERROR', 'Invalid photo path');
  await writeFile(destination, bytes, { flag: 'wx', mode: 0o640 });
  return filename;
}
