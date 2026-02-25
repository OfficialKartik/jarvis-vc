import "@snazzah/davey/register"
import "dotenv/config"
import { Client, GatewayIntentBits } from "discord.js"
import { startVoiceSession, stopVoiceSession } from "./voice.js"

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
})

client.once("ready", () => {
  console.log("Jarvis realtime online.")
})

client.on("messageCreate", async (message) => {
  if (message.author.bot) return
  if (!message.content.startsWith(",")) return

  const args = message.content.slice(1).split(" ")
  const cmd = args[0]

  if (cmd === "jarvis" && args[1] === "convo") {
    if (!message.member.voice.channel)
      return message.reply("VC join karo pehle.")

    await startVoiceSession(message.member.voice.channel)
    return message.reply("Jarvis joined VC.")
  }

  if (cmd === "jarvis" && args[1] === "off") {
    stopVoiceSession()
    return message.reply("Jarvis left VC.")
  }
})

client.login(process.env.DISCORD_TOKEN)
