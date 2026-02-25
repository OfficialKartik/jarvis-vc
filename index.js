import "dotenv/config"
import { Client, GatewayIntentBits } from "discord.js"
import {
  joinVoiceChannel,
  getVoiceConnection
} from "@discordjs/voice"

import { createRealtimeSession } from "./realtime.js"

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent
  ]
})

let realtimeSession = null

client.on("messageCreate", async (message) => {
  if (message.author.bot) return

  if (message.content === ",jarvis convo") {

    const channel = message.member.voice.channel
    if (!channel) {
      return message.reply("VC join karo pehle.")
    }

    joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator
    })

    realtimeSession = createRealtimeSession()

    message.reply("Conversation mode active.")
  }

  if (message.content === ",jarvis leave") {
    const connection = getVoiceConnection(message.guild.id)
    if (connection) connection.destroy()

    if (realtimeSession) realtimeSession.close()

    message.reply("Jarvis left.")
  }
})

client.login(process.env.DISCORD_TOKEN)
