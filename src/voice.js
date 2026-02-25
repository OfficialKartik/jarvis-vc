import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  StreamType,
  getVoiceConnection,
  EndBehaviorType
} from "@discordjs/voice"

import prism from "prism-media"
import WebSocket from "ws"
import { PassThrough } from "stream"

let connection
let player
let ws
let active = false
let realtimeReady = false

export async function startVoiceSession(channel) {

  if (active) return
  active = true
  realtimeReady = false

  connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator
  })

  player = createAudioPlayer()
  connection.subscribe(player)

  ws = new WebSocket(
    "wss://api.openai.com/v1/realtime?model=gpt-realtime-1.5",
    {
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      }
    }
  )

  ws.on("open", () => {
    console.log("Realtime connected.")
    realtimeReady = true

    ws.send(JSON.stringify({
      type: "session.update",
      session: {
        modalities: ["audio"],
        instructions: "Respond in Hindi in a natural human tone."
      }
    }))
  })

  ws.on("error", (err) => {
    console.error("WS ERROR:", err)
  })

  ws.on("close", () => {
    console.log("WS closed")
  })

  // ===== PLAYBACK PIPELINE =====

  let inputStream = null
  let ffmpeg = null
  let opusEncoder = null

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString())
      console.log("OPENAI:", msg.type)

      if (msg.type === "response.created") {

        inputStream = new PassThrough()

        ffmpeg = new prism.FFmpeg({
          args: [
            "-f", "s16le",
            "-ar", "48000",
            "-ac", "1",
            "-i", "pipe:0",
            "-ar", "48000",
            "-ac", "2",
            "-f", "s16le",
            "pipe:1"
          ]
        })

        opusEncoder = new prism.opus.Encoder({
          frameSize: 960,
          channels: 2,
          rate: 48000
        })

        const opusStream = inputStream
          .pipe(ffmpeg)
          .pipe(opusEncoder)

        const resource = createAudioResource(opusStream, {
          inputType: StreamType.Opus
        })

        player.play(resource)
      }

      if (msg.type === "response.output_audio.delta") {
        if (!inputStream) return
        const chunk = Buffer.from(msg.delta, "base64")
        inputStream.write(chunk)
      }

      if (msg.type === "response.completed") {
        if (inputStream) {
          inputStream.end()
          inputStream = null
        }
      }

    } catch (err) {
      console.error("Playback error:", err)
    }
  })

  // ===== INPUT CAPTURE =====

  const receiver = connection.receiver

  receiver.speaking.on("start", (userId) => {

    if (!realtimeReady) return

    console.log("User speaking:", userId)

    const opusStream = receiver.subscribe(userId, {
      end: {
        behavior: EndBehaviorType.AfterSilence,
        duration: 1500 // increased silence
      }
    })

    const pcmStream = opusStream.pipe(
      new prism.opus.Decoder({
        frameSize: 960,
        channels: 2,
        rate: 48000
      })
    )

    pcmStream.on("data", (chunk) => {

      if (!realtimeReady) return
      if (ws.readyState !== 1) return

      ws.send(JSON.stringify({
        type: "input_audio_buffer.append",
        audio: chunk.toString("base64")
      }))
    })

    pcmStream.on("end", () => {

      if (!realtimeReady) return

      console.log("Audio committed")

      ws.send(JSON.stringify({
        type: "input_audio_buffer.commit"
      }))

      ws.send(JSON.stringify({
        type: "response.create"
      }))
    })

    pcmStream.on("error", console.error)
  })
}

export function stopVoiceSession() {

  if (ws) ws.close()

  if (connection) {
    const conn = getVoiceConnection(connection.joinConfig.guildId)
    if (conn) conn.destroy()
  }

  active = false
  realtimeReady = false
}
