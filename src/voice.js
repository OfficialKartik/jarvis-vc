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

  // ✅ Using gpt-realtime-1.5
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

    // Optional but good practice
    ws.send(JSON.stringify({
      type: "session.update",
      session: {
        modalities: ["audio"],
        instructions: "Respond in Hindi. Natural tone."
      }
    }))
  })

  ws.on("error", console.error)

  






let pcmStream = null

ws.on("message", (data) => {
  try {
    const msg = JSON.parse(data.toString())

    if (msg.type === "response.created") {

      pcmStream = new PassThrough()

      const resource = createAudioResource(pcmStream, {
        inputType: StreamType.Raw,
        inlineVolume: false
      })

      player.play(resource)
    }

    if (msg.type === "response.output_audio.delta") {
      if (!pcmStream) return

      const chunk = Buffer.from(msg.delta, "base64")

      // Convert 24kHz mono → 48kHz stereo manually
      const converted = Buffer.alloc(chunk.length * 4)

      for (let i = 0; i < chunk.length; i += 2) {
        const sample = chunk.readInt16LE(i)

        // duplicate sample for stereo
        converted.writeInt16LE(sample, i * 2)
        converted.writeInt16LE(sample, i * 2 + 2)
      }

      pcmStream.write(converted)
    }

    if (msg.type === "response.completed") {
      if (pcmStream) {
        pcmStream.end()
        pcmStream = null
      }
    }

  } catch (err) {
    console.error("Playback error:", err)
  }
})
  const receiver = connection.receiver

  receiver.speaking.on("start", (userId) => {

    if (!realtimeReady) return

    const opusStream = receiver.subscribe(userId, {
      end: {
        behavior: EndBehaviorType.AfterSilence,
        duration: 1000
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
