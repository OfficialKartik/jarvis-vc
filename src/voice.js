import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  getVoiceConnection,
  EndBehaviorType
} from "@discordjs/voice"

import prism from "prism-media"
import WebSocket from "ws"

let connection
let player
let ws
let active = false

export async function startVoiceSession(channel) {

  if (active) return
  active = true

  connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator
  })

  player = createAudioPlayer()
  connection.subscribe(player)

  ws = new WebSocket(
    "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview",
    {
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      }
    }
  )

  ws.on("open", () => {
    console.log("Realtime connected.")
  })

  ws.on("message", (data) => {
    const msg = JSON.parse(data.toString())

    if (msg.type === "response.output_audio.delta") {
      const audio = Buffer.from(msg.delta, "base64")
      const resource = createAudioResource(audio)
      player.play(resource)
    }
  })

  const receiver = connection.receiver

  connection.receiver.speaking.on("start", (userId) => {

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
      const base64 = chunk.toString("base64")

      ws.send(JSON.stringify({
        type: "input_audio_buffer.append",
        audio: base64
      }))
    })

    pcmStream.on("end", () => {
      ws.send(JSON.stringify({
        type: "input_audio_buffer.commit"
      }))

      ws.send(JSON.stringify({
        type: "response.create"
      }))
    })
  })
}

export function stopVoiceSession() {

  if (ws) ws.close()

  if (connection) {
    const conn = getVoiceConnection(connection.joinConfig.guildId)
    if (conn) conn.destroy()
  }

  active = false
}
