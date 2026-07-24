export const TIKTOK_VIDEO_TYPES = new Map([
  ["video/mp4", "MP4"],
  ["video/quicktime", "MOV"],
]);
export const MAX_TIKTOK_FILE_SIZE = 128 * 1024 * 1024;
export const MAX_TIKTOK_DURATION_SECONDS = 600;

export function readIsoDuration(buffer) {
  for (let offset = 0; offset + 12 <= buffer.length;) {
    const size = buffer.readUInt32BE(offset);
    if (size < 8 || offset + size > buffer.length) break;
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    if (type === "moov") {
      const end = offset + size;
      for (let inner = offset + 8; inner + 12 <= end;) {
        const innerSize = buffer.readUInt32BE(inner);
        if (innerSize < 8 || inner + innerSize > end) break;
        if (buffer.toString("ascii", inner + 4, inner + 8) === "mvhd") {
          const version = buffer[inner + 8];
          const timescaleOffset = version === 1 ? inner + 28 : inner + 20;
          const durationOffset = version === 1 ? inner + 32 : inner + 24;
          const timescale = buffer.readUInt32BE(timescaleOffset);
          const duration = version === 1
            ? Number(buffer.readBigUInt64BE(durationOffset))
            : buffer.readUInt32BE(durationOffset);
          return timescale > 0 ? duration / timescale : null;
        }
        inner += innerSize;
      }
    }
    offset += size;
  }
  return null;
}

export function validateTikTokVideo(file, buffer, { durationSeconds } = {}) {
  const errors = [];
  if (!file || typeof file.arrayBuffer !== "function") return ["Bitte eine Videodatei auswählen."];
  if (!TIKTOK_VIDEO_TYPES.has(file.type)) errors.push("Erlaubt sind MP4- und MOV-Videos.");
  if (!file.size || file.size > MAX_TIKTOK_FILE_SIZE) errors.push("Das Video darf in dieser App maximal 128 MB groß sein.");
  const duration = durationSeconds ?? readIsoDuration(buffer);
  if (duration == null) errors.push("Die Videodauer konnte nicht sicher geprüft werden.");
  else if (duration <= 0 || duration > MAX_TIKTOK_DURATION_SECONDS) errors.push("Das Video muss länger als 0 Sekunden und höchstens 10 Minuten lang sein.");
  return errors;
}

export function uploadChunks(size) {
  if (size <= 5 * 1024 * 1024) return { chunkSize: size, count: 1 };
  const chunkSize = 10 * 1024 * 1024;
  return { chunkSize, count: Math.max(1, Math.floor(size / chunkSize)) };
}
