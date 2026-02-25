import WebSocket from "ws"

let ws
let outputChunks = []

export function startRealtime() {
  ws = new WebSocket(
    "wss://api.openai.com/v1/realtime?model=gpt-realtime-1.5",
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      }
    }
  )

  ws.on("open", () => {
    ws.send(JSON.stringify({
      type: "session.update",
      session: {
        modalities: ["audio"],
        instructions: "Respond in Hindi naturally.",
        output_audio_format: {
          type: "pcm16",
          sample_rate: 24000
        }
      }
    }))
  })

  ws.on("message", (data) => {
    const msg = JSON.parse(data.toString())

    if (msg.type === "response.output_audio.delta") {
      outputChunks.push(Buffer.from(msg.delta, "base64"))
    }
  })
}

export function sendAudioChunk(chunk) {
  ws.send(JSON.stringify({
    type: "input_audio_buffer.append",
    audio: chunk.toString("base64")
  }))
}

export function commitAudio() {
  ws.send(JSON.stringify({ type: "input_audio_buffer.commit" }))
  ws.send(JSON.stringify({ type: "response.create" }))
}

export function collectOutput() {
  const finalBuffer = Buffer.concat(outputChunks)
  outputChunks = []
  return finalBuffer
}
