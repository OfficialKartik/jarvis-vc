export async function playBuffer(guildId, voiceChannelId, mp3Buffer) {

  const player = manager.createPlayer({
    guildId,
    voiceChannelId
  })

  await player.connect()

  const base64 = mp3Buffer.toString("base64")

  await player.play({
    encoded: `data:audio/mp3;base64,${base64}`
  })
}
