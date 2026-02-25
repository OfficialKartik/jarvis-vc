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
      authorization: "jarvispass", // MUST match application.yml
      secure: false
    }
  ],
  sendToShard: (guildId, payload) => {
    const guild = client.guilds.cache.get(guildId)
    if (guild) guild.shard.send(payload)
  }
})

/* ===== Lavalink Events ===== */

manager.on("nodeConnect", (node) => {
  console.log(`✅ Lavalink connected: ${node.id}`)
})

manager.on("nodeError", (node, error) => {
  console.error(`❌ Lavalink error (${node.id}):`, error)
})

/* ===== Voice State Forwarding ===== */

client.on("raw", (packet) => {
  manager.handleVoiceUpdate(packet)
})

/* ===========================
   Client Ready
=========================== */

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`)
  await manager.init(client.user.id)
  startRealtime()
})

/* ===========================
   SIMPLE COMMANDS
=========================== */

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return

  if (interaction.commandName === "join") {

    const member = interaction.member
    const voiceChannel = member.voice?.channel

    if (!voiceChannel)
      return interaction.reply({
        content: "Join a voice channel first.",
        ephemeral: true
      })

    await interaction.reply("Jarvis joining...")

    const player = manager.createPlayer({
      guildId: interaction.guildId,
      voiceChannelId: voiceChannel.id,
      textChannelId: interaction.channelId,
      selfDeaf: false
    })

    await player.connect()
  }

  if (interaction.commandName === "ask") {

    await interaction.reply("Processing...")

    try {
      const pcm = collectOutput()
      const mp3 = await pcmToMp3(pcm)

      await playBuffer(interaction.guildId, mp3)

      await interaction.editReply("Done.")
    } catch (err) {
      console.error("Ask error:", err)
      await interaction.editReply("Error while processing.")
    }
  }
})

client.login(process.env.DISCORD_TOKEN)
