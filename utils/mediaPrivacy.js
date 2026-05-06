import * as FileSystem from 'expo-file-system/legacy';
import { base64FromBytes, bytesFromBase64 } from './base64Bytes';

const JPEG_MIME_TYPE = 'image/jpeg';
const DROPPED_MARKERS = new Set([0xed, 0xfe]); // IPTC, comments
const XMP_IDENTIFIER = 'http://ns.adobe.com/xap/1.0/\0';
const TYPE_BYTE_SIZES = {
  1: 1, // BYTE
  2: 1, // ASCII
  3: 2, // SHORT
  4: 4, // LONG
  5: 8, // RATIONAL
  7: 1, // UNDEFINED
  9: 4, // SLONG
  10: 8, // SRATIONAL
};

function isVideoAsset(asset = {}) {
  return asset?.type === 'video' || asset?.mimeType?.startsWith?.('video/');
}

function isPhotoAsset(asset = {}) {
  if (!asset?.uri || isVideoAsset(asset)) return false;
  if (asset?.type === 'image' || asset?.mimeType?.startsWith?.('image/')) return true;

  return /\.(jpe?g|heic|heif)$/i.test(asset.uri.split('?')[0] || '');
}

function concatChunks(chunks, totalLength) {
  const output = new Uint8Array(totalLength);
  let cursor = 0;

  for (const chunk of chunks) {
    output.set(chunk, cursor);
    cursor += chunk.length;
  }

  return output;
}

function readAscii(bytes, offset, length) {
  if (offset < 0 || offset + length > bytes.length) return '';

  let value = '';
  for (let i = offset; i < offset + length; i += 1) {
    value += String.fromCharCode(bytes[i]);
  }

  return value;
}

function isXmpSegment(bytes, payloadStart, segmentEnd) {
  return readAscii(bytes, payloadStart, Math.min(XMP_IDENTIFIER.length, segmentEnd - payloadStart))
    === XMP_IDENTIFIER;
}

function isExifSegment(bytes, payloadStart, segmentEnd) {
  return segmentEnd - payloadStart > 14
    && readAscii(bytes, payloadStart, 6) === 'Exif\0\0';
}

function createTiffReader(bytes, tiffStart, segmentEnd) {
  const byteOrder = readAscii(bytes, tiffStart, 2);
  const isLittleEndian = byteOrder === 'II';

  if (!isLittleEndian && byteOrder !== 'MM') return null;

  const readUint16 = (offset) => {
    if (offset < tiffStart || offset + 2 > segmentEnd) return null;
    return isLittleEndian
      ? bytes[offset] + (bytes[offset + 1] << 8)
      : (bytes[offset] << 8) + bytes[offset + 1];
  };

  const readUint32 = (offset) => {
    if (offset < tiffStart || offset + 4 > segmentEnd) return null;
    return isLittleEndian
      ? bytes[offset] + (bytes[offset + 1] * 256) + (bytes[offset + 2] * 65536) + (bytes[offset + 3] * 16777216)
      : (bytes[offset] * 16777216) + (bytes[offset + 1] * 65536) + (bytes[offset + 2] * 256) + bytes[offset + 3];
  };

  if (readUint16(tiffStart + 2) !== 42) return null;

  return { isLittleEndian, readUint16, readUint32 };
}

function zeroRange(bytes, start, length, segmentEnd) {
  if (start < 0 || length <= 0 || start + length > segmentEnd) return;
  bytes.fill(0, start, start + length);
}

function zeroTiffValue(bytes, reader, tiffStart, segmentEnd, entryOffset) {
  const type = reader.readUint16(entryOffset + 2);
  const count = reader.readUint32(entryOffset + 4);
  const byteSize = TYPE_BYTE_SIZES[type] || 0;
  const valueSize = byteSize * count;

  if (!byteSize || !Number.isFinite(valueSize) || valueSize <= 0) return;

  if (valueSize <= 4) {
    zeroRange(bytes, entryOffset + 8, 4, segmentEnd);
    return;
  }

  const valueOffset = reader.readUint32(entryOffset + 8);
  if (valueOffset == null) return;

  zeroRange(bytes, tiffStart + valueOffset, valueSize, segmentEnd);
}

function zeroGpsIfd(bytes, reader, tiffStart, segmentEnd, gpsIfdOffset) {
  const gpsIfdStart = tiffStart + gpsIfdOffset;
  const entryCount = reader.readUint16(gpsIfdStart);

  if (entryCount == null) return;

  const entriesStart = gpsIfdStart + 2;
  const entriesEnd = entriesStart + entryCount * 12;

  if (entriesEnd + 4 > segmentEnd) return;

  for (let i = 0; i < entryCount; i += 1) {
    zeroTiffValue(bytes, reader, tiffStart, segmentEnd, entriesStart + i * 12);
  }

  zeroRange(bytes, gpsIfdStart, 2 + entryCount * 12 + 4, segmentEnd);
}

function scrubExifGps(bytes, payloadStart, segmentEnd) {
  if (!isExifSegment(bytes, payloadStart, segmentEnd)) return null;

  const output = new Uint8Array(bytes);
  const tiffStart = payloadStart + 6;
  const reader = createTiffReader(output, tiffStart, segmentEnd);

  if (!reader) return null;

  const ifd0Offset = reader.readUint32(tiffStart + 4);
  if (ifd0Offset == null) return null;

  const ifd0Start = tiffStart + ifd0Offset;
  const entryCount = reader.readUint16(ifd0Start);

  if (entryCount == null) return null;

  const entriesStart = ifd0Start + 2;
  const entriesEnd = entriesStart + entryCount * 12;

  if (entriesEnd + 4 > segmentEnd) return null;

  let removedGps = false;

  for (let i = 0; i < entryCount; i += 1) {
    const entryOffset = entriesStart + i * 12;
    const tag = reader.readUint16(entryOffset);

    if (tag !== 0x8825) continue;

    const gpsIfdOffset = reader.readUint32(entryOffset + 8);
    if (gpsIfdOffset != null) {
      zeroGpsIfd(output, reader, tiffStart, segmentEnd, gpsIfdOffset);
    }

    zeroRange(output, entryOffset, 12, segmentEnd);
    removedGps = true;
  }

  return removedGps ? output : null;
}

function stripJpegMetadata(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return null;
  }

  const chunks = [bytes.subarray(0, 2)];
  let totalLength = 2;
  let offset = 2;
  let removed = false;

  while (offset + 1 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      chunks.push(bytes.subarray(offset));
      totalLength += bytes.length - offset;
      break;
    }

    let markerOffset = offset + 1;
    while (markerOffset < bytes.length && bytes[markerOffset] === 0xff) {
      markerOffset += 1;
    }

    if (markerOffset >= bytes.length) {
      chunks.push(bytes.subarray(offset));
      totalLength += bytes.length - offset;
      break;
    }

    const marker = bytes[markerOffset];
    if (marker === 0xda || marker === 0xd9) {
      chunks.push(bytes.subarray(offset));
      totalLength += bytes.length - offset;
      break;
    }

    const isStandaloneMarker = marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);
    if (isStandaloneMarker) {
      const chunk = bytes.subarray(offset, markerOffset + 1);
      chunks.push(chunk);
      totalLength += chunk.length;
      offset = markerOffset + 1;
      continue;
    }

    if (markerOffset + 2 >= bytes.length) {
      chunks.push(bytes.subarray(offset));
      totalLength += bytes.length - offset;
      break;
    }

    const segmentLength = bytes[markerOffset + 1] * 256 + bytes[markerOffset + 2];
    const segmentEnd = markerOffset + 1 + segmentLength;

    if (segmentLength < 2 || segmentEnd > bytes.length) {
      chunks.push(bytes.subarray(offset));
      totalLength += bytes.length - offset;
      break;
    }

    const payloadStart = markerOffset + 3;
    let chunk = null;

    if (marker === 0xe1 && isExifSegment(bytes, payloadStart, segmentEnd)) {
      const scrubbedBytes = scrubExifGps(bytes, payloadStart, segmentEnd);
      chunk = scrubbedBytes?.subarray(offset, segmentEnd) || bytes.subarray(offset, segmentEnd);
      removed = !!scrubbedBytes || removed;
    } else if ((marker === 0xe1 && isXmpSegment(bytes, payloadStart, segmentEnd)) || DROPPED_MARKERS.has(marker)) {
      removed = true;
    } else {
      chunk = bytes.subarray(offset, segmentEnd);
    }

    if (chunk) {
      chunks.push(chunk);
      totalLength += chunk.length;
    }

    offset = segmentEnd;
  }

  return removed ? concatChunks(chunks, totalLength) : null;
}

function withJpegExtension(fileName, fallbackName) {
  const rawName = fileName || fallbackName;
  const withoutQuery = rawName.split('?')[0];
  const withoutExtension = withoutQuery.replace(/\.[^/.]+$/, '');

  return `${withoutExtension || fallbackName.replace(/\.[^/.]+$/, '')}.jpg`;
}

function getContainingDirectory(uri = '') {
  const slashIndex = uri.lastIndexOf('/');
  return slashIndex >= 0 ? uri.slice(0, slashIndex + 1) : '';
}

async function getFileSize(uri) {
  try {
    const info = await FileSystem.getInfoAsync(uri, { size: true });
    return info?.exists && typeof info.size === 'number' ? info.size : undefined;
  } catch (_error) {
    return undefined;
  }
}

export async function stripPhotoMetadataFromAsset(asset, {
  fileNamePrefix = 'photo',
  index = 0,
} = {}) {
  if (!isPhotoAsset(asset)) return asset;

  const sourceBase64 = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const strippedBytes = stripJpegMetadata(bytesFromBase64(sourceBase64));

  if (!strippedBytes) return asset;

  const targetDirectory = FileSystem.cacheDirectory || getContainingDirectory(asset.uri);
  const targetUri = `${targetDirectory}betweenus_private_${Date.now()}_${index}.jpg`;
  await FileSystem.writeAsStringAsync(targetUri, base64FromBytes(strippedBytes), {
    encoding: FileSystem.EncodingType.Base64,
  });

  return {
    ...asset,
    uri: targetUri,
    type: 'image',
    mimeType: JPEG_MIME_TYPE,
    fileName: withJpegExtension(
      asset.fileName,
      `${fileNamePrefix}_${Date.now()}_${index}.jpg`
    ),
    fileSize: await getFileSize(targetUri),
  };
}

export async function stripPhotoMetadataFromAssets(assets = [], options = {}) {
  const strippedAssets = [];

  for (let index = 0; index < assets.length; index += 1) {
    strippedAssets.push(await stripPhotoMetadataFromAsset(assets[index], { ...options, index }));
  }

  return strippedAssets;
}
