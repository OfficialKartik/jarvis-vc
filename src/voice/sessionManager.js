import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  getVoiceConnection
} from "@discordjs/voice"

import prism from "prism-media"
import { connectRealtime, sendAudioChunk, commitAudio } from "./realtimeClient.js"
import { getPersonalityContext } from "./personality.js"

let connection
let player
let receiver
let active = false

export async function startJarvis(channel, client) {

  if (active) return
  active = true

  connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator
  })

  player = createAudioPlayer()
  connection.subscribe(player)

  receiver = connection.receiver

  connectRealtime((text) => {
    speak(text)
  })

  channel.guild.voiceStates.cache.forEach((state) => {
    if (state.channelId === channel.id && !state.member.user.bot) {
      listenToUser(state.member.user.id)
    }
  })
}

function listenToUser(userId) {

  const opusStream = receiver.subscribe(userId)

  const pcmStream = opusStream.pipe(new prism.opus.Decoder({
    frameSize: 960,
    channels: 2,
    rate: 48000
  }))

  pcmStream.on("data", (chunk) => {
    const base64 = chunk.toString("base64")
    sendAudioChunk(base64)
  })

  pcmStream.on("end", () => {
    commitAudio()
  })
}

function speak(text) {

  const resource = createAudioResource(
    Buffer.from(text)
  )

  player.play(resource)
}

export function stopJarvis() {

  const conn = getVoiceConnection(connection.joinConfig.guildId)
  if (conn) conn.destroy()

  active = false
}
