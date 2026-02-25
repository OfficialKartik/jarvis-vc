import "dotenv/config"
import { Client, GatewayIntentBits } from "discord.js"
import { startJarvis, stopJarvis } from "./voice/sessionManager.js"

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
})

client.once("ready", () => {
  console.log("Jarvis online.")
})

client.on("messageCreate", async (message) => {
  if (message.author.bot) return
  if (!message.content.startsWith(",")) return

  const args = message.content.slice(1).split(" ")
  const command = args[0]

  if (command === "jarvis" && args[1] === "convo") {
    if (!message.member.voice.channel)
      return message.reply("VC join karo pehle.")

    await startJarvis(message.member.voice.channel, client)
    return message.reply("Conversation mode enabled.")
  }

  if (command === "jarvis" && args[1] === "off") {
    stopJarvis()
    return message.reply("Jarvis disconnected.")
  }
})

client.login(process.env.DISCORD_TOKEN)
