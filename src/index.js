import "dotenv/config"
import { Client, GatewayIntentBits, Partials } from "discord.js"
import { LavalinkManager } from "lavalink-client"
import { pcmToMp3 } from "./audioProcessor.js"
import { startRealtime, collectOutput } from "./openaiRealtime.js"
import { playBuffer } from "./voiceTransport.js"

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Channel]
})

/* ===========================
   Lavalink Setup
=========================== */

export const manager = new LavalinkManager({
  nodes: [
    {
      id: "jarvis-node",
      host: "127.0.0.1",
      port: 2333,
      authorization: "jarvispass",
      secure: false
    }
  ],
  sendToShard: (guildId, payload) => {
    const guild = client.guilds.cache.get(guildId)
    if (guild) guild.shard.send(payload)
  }
})

client.on("raw", (d) => manager.updateVoiceState(d))

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`)
  await manager.init(client.user.id)
  startRealtime()
})

/* ===========================
   SIMPLE JOIN COMMAND
=========================== */

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return

  if (interaction.commandName === "join") {

    const member = interaction.member
    const voiceChannel = member.voice.channel

    if (!voiceChannel)
      return interaction.reply({ content: "Join a voice channel first.", ephemeral: true })

    await interaction.reply("Jarvis joining...")

    const player = manager.createPlayer({
      guildId: interaction.guildId,
      voiceChannelId: voiceChannel.id,
      textChannelId: interaction.channelId
    })

    await player.connect()
  }

  if (interaction.commandName === "ask") {

    await interaction.reply("Processing...")

    // Collect AI output (after you've committed input audio)
    const pcm = collectOutput()
    const mp3 = await pcmToMp3(pcm)

    await playBuffer(interaction.guildId, mp3)

    await interaction.editReply("Done.")
  }
})

client.login(process.env.DISCORD_TOKEN)
