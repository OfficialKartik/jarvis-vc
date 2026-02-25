import { spawn } from "child_process"

export function pcmToMp3(pcmBuffer) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-f", "s16le",
      "-ar", "24000",
      "-ac", "1",
      "-i", "pipe:0",
      "-f", "mp3",
      "pipe:1"
    ])

    let chunks = []

    ffmpeg.stdout.on("data", (data) => chunks.push(data))
    ffmpeg.stderr.on("data", () => {})
    ffmpeg.on("close", () => {
      resolve(Buffer.concat(chunks))
    })

    ffmpeg.stdin.write(pcmBuffer)
    ffmpeg.stdin.end()
  })
}
