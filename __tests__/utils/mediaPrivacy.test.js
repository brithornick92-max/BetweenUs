jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  EncodingType: { Base64: 'base64' },
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true, size: 12 }),
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
}));

const FileSystem = require('expo-file-system/legacy');
const {
  stripPhotoMetadataFromAsset,
  stripPhotoMetadataFromAssets,
} = require('../../utils/mediaPrivacy');

function toBase64(bytes) {
  return globalThis.Buffer.from(Uint8Array.from(bytes)).toString('base64');
}

function fromBase64(value) {
  return Array.from(globalThis.Buffer.from(value, 'base64'));
}

function ascii(value) {
  return Array.from(value).map((char) => char.charCodeAt(0));
}

function le16(value) {
  return [value & 0xff, (value >> 8) & 0xff];
}

function le32(value) {
  return [
    value & 0xff,
    (value >> 8) & 0xff,
    (value >> 16) & 0xff,
    (value >> 24) & 0xff,
  ];
}

function appSegment(marker, payload) {
  const length = payload.length + 2;
  return [0xff, marker, (length >> 8) & 0xff, length & 0xff, ...payload];
}

describe('mediaPrivacy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('scrubs JPEG GPS metadata while preserving EXIF orientation', async () => {
    const exifPayload = [
      ...ascii('Exif'), 0x00, 0x00,
      0x49, 0x49, 0x2a, 0x00, ...le32(8),
      ...le16(2),
      0x12, 0x01, ...le16(3), ...le32(1), ...le16(6), 0x00, 0x00,
      0x25, 0x88, ...le16(4), ...le32(1), ...le32(38),
      ...le32(0),
      ...le16(1),
      0x01, 0x00, ...le16(2), ...le32(2), ...ascii('N'), 0x00, 0x00, 0x00,
      ...le32(0),
    ];
    FileSystem.readAsStringAsync.mockResolvedValueOnce(toBase64([
      0xff, 0xd8,
      ...appSegment(0xe1, exifPayload),
      0xff, 0xfe, 0x00, 0x05, 0x01, 0x02, 0x03,
      0xff, 0xda, 0x00, 0x04, 0x00, 0x00, 0x11, 0x22, 0xff, 0xd9,
    ]));

    const result = await stripPhotoMetadataFromAsset({
      uri: 'file:///incoming/photo.jpeg',
      type: 'image',
      mimeType: 'image/jpeg',
      fileName: 'photo.jpeg',
      fileSize: 999,
    });

    expect(result.uri).toMatch(/^file:\/\/\/cache\/betweenus_private_/);
    expect(result.mimeType).toBe('image/jpeg');
    expect(result.fileName).toBe('photo.jpg');
    expect(result.fileSize).toBe(12);

    const [, writtenBase64] = FileSystem.writeAsStringAsync.mock.calls[0];
    const writtenBytes = fromBase64(writtenBase64);

    expect(writtenBytes.slice(2, 6)).toEqual([0xff, 0xe1, 0x00, 0x40]);
    expect(writtenBytes.slice(22, 34)).toEqual([
      0x12, 0x01, ...le16(3), ...le32(1), ...le16(6), 0x00, 0x00,
    ]);
    expect(writtenBytes.slice(34, 46)).toEqual(new Array(12).fill(0));
    expect(writtenBytes.slice(50, 68)).toEqual(new Array(18).fill(0));
    expect(writtenBytes).not.toContain(0xfe);
    expect(writtenBytes.slice(68)).toEqual([
      0xff, 0xda, 0x00, 0x04, 0x00, 0x00, 0x11, 0x22, 0xff, 0xd9,
    ]);
  });

  it('leaves videos unchanged', async () => {
    const asset = {
      uri: 'file:///incoming/video.mov',
      type: 'video',
      mimeType: 'video/quicktime',
    };

    await expect(stripPhotoMetadataFromAsset(asset)).resolves.toBe(asset);
    expect(FileSystem.readAsStringAsync).not.toHaveBeenCalled();
  });

  it('processes multiple photo assets sequentially', async () => {
    const calls = [];
    const resolvers = [];
    const plainJpeg = toBase64([0xff, 0xd8, 0xff, 0xda, 0x00, 0x04, 0x00, 0x00, 0xff, 0xd9]);

    FileSystem.readAsStringAsync.mockImplementation((uri) => new Promise((resolve) => {
      calls.push(`read:${uri}`);
      resolvers.push(resolve);
    }));

    const stripPromise = stripPhotoMetadataFromAssets([
      { uri: 'file:///incoming/one.jpg', type: 'image', mimeType: 'image/jpeg' },
      { uri: 'file:///incoming/two.jpg', type: 'image', mimeType: 'image/jpeg' },
    ]);

    await Promise.resolve();
    expect(calls).toEqual(['read:file:///incoming/one.jpg']);

    resolvers[0](plainJpeg);
    await Promise.resolve();
    await Promise.resolve();
    expect(calls).toEqual([
      'read:file:///incoming/one.jpg',
      'read:file:///incoming/two.jpg',
    ]);

    resolvers[1](plainJpeg);
    await stripPromise;
  });
});
