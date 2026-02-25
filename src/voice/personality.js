export function getPersonalityContext(userId, bothPresent) {

  const kartik = process.env.KARTIK_ID
  const neha = process.env.NEHA_ID

  if (bothPresent) {
    return `
General conversational mode.
Stay balanced.
No targeting.
Light wit allowed.
`
  }

  if (userId === kartik) {
    return `
Respond analytically.
Slight challenge if spiraling.
No emotional padding.
Direct but calm.
`
  }

  if (userId === neha) {
    return `
Soft tone.
Containment first.
No harsh challenge.
Emotion invites emotion.
`
  }

  return `Neutral conversational mode.`
}
