const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const outputDir = path.join(projectRoot, 'assets', 'simulator-media');

const photoSeeds = [
  {
    source: path.join(projectRoot, 'assets', 'romantic.png'),
    output: path.join(outputDir, 'between-us-date-night-1.png'),
  },
  {
    source: path.join(projectRoot, 'assets', 'cozy.png'),
    output: path.join(outputDir, 'between-us-date-night-2.png'),
  },
  {
    source: path.join(projectRoot, 'assets', 'playful.png'),
    output: path.join(outputDir, 'between-us-date-night-3.png'),
  },
];

const videoOutput = path.join(outputDir, 'between-us-date-night-video.mp4');
const dryRun = process.argv.includes('--dry-run');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: options.captureOutput ? 'pipe' : 'inherit',
    encoding: 'utf8',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const detail = options.captureOutput
      ? `\n${result.stdout || ''}${result.stderr || ''}`
      : '';
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}.${detail}`);
  }

  return result;
}

function ensureBootedSimulator() {
  const result = run('xcrun', ['simctl', 'list', 'devices', 'booted'], { captureOutput: true });
  if (!result.stdout.includes('(Booted)')) {
    throw new Error('No booted iOS simulator found. Start a simulator first, then rerun this script.');
  }
}

function seedPhotos() {
  fs.mkdirSync(outputDir, { recursive: true });

  for (const photo of photoSeeds) {
    fs.copyFileSync(photo.source, photo.output);
  }
}

function generateVideo() {
  const swiftSource = `
import AVFoundation
import CoreGraphics
import CoreImage
import Foundation

let outputPath = CommandLine.arguments[1]
let outputUrl = URL(fileURLWithPath: outputPath)
let fileManager = FileManager.default

if fileManager.fileExists(atPath: outputPath) {
    try fileManager.removeItem(at: outputUrl)
}

let size = CGSize(width: 720, height: 1280)
let writer = try AVAssetWriter(outputURL: outputUrl, fileType: .mp4)
let settings: [String: Any] = [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: Int(size.width),
    AVVideoHeightKey: Int(size.height)
]

let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
input.expectsMediaDataInRealTime = false

let attributes: [String: Any] = [
    kCVPixelBufferPixelFormatTypeKey as String: Int(kCVPixelFormatType_32ARGB),
    kCVPixelBufferWidthKey as String: Int(size.width),
    kCVPixelBufferHeightKey as String: Int(size.height),
]

let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: attributes)
precondition(writer.canAdd(input))
writer.add(input)
precondition(writer.startWriting())
writer.startSession(atSourceTime: .zero)

let ciContext = CIContext()
let colors: [(CGFloat, CGFloat, CGFloat)] = [
    (0.96, 0.62, 0.66),
    (0.98, 0.78, 0.56),
    (0.84, 0.91, 0.68),
    (0.64, 0.82, 0.94)
]
let framesPerColor = 30
var frameIndex = 0

func makeBuffer() -> CVPixelBuffer {
    var buffer: CVPixelBuffer?
    CVPixelBufferCreate(kCFAllocatorDefault, Int(size.width), Int(size.height), kCVPixelFormatType_32ARGB, nil, &buffer)
    return buffer!
}

for color in colors {
    let image = CIImage(color: CIColor(red: color.0, green: color.1, blue: color.2))
        .cropped(to: CGRect(origin: .zero, size: size))

    for _ in 0..<framesPerColor {
        while !input.isReadyForMoreMediaData {
            Thread.sleep(forTimeInterval: 0.01)
        }

        let buffer = makeBuffer()
        ciContext.render(image, to: buffer)
        let time = CMTime(value: Int64(frameIndex), timescale: 30)
        adaptor.append(buffer, withPresentationTime: time)
        frameIndex += 1
    }
}

input.markAsFinished()
writer.finishWriting {}
while writer.status == .writing {
    Thread.sleep(forTimeInterval: 0.05)
}

if writer.status != .completed {
    throw writer.error ?? NSError(domain: "seedSimulatorMedia", code: 1)
}
`;

  const swiftFile = path.join(os.tmpdir(), 'between-us-seed-simulator-media.swift');
  fs.writeFileSync(swiftFile, swiftSource);
  run('xcrun', ['swift', swiftFile, videoOutput]);
}

function importMedia() {
  const mediaPaths = [...photoSeeds.map((photo) => photo.output), videoOutput];
  run('xcrun', ['simctl', 'addmedia', 'booted', ...mediaPaths]);
}

function main() {
  ensureBootedSimulator();
  seedPhotos();
  generateVideo();

  if (dryRun) {
    console.log(`Prepared simulator media in ${outputDir}`);
    return;
  }

  importMedia();
  console.log(`Imported ${photoSeeds.length} photos and 1 video into the booted simulator.`);
  console.log(`Files are available in ${outputDir}`);
}

main();