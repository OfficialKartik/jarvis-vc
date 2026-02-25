import WebSocket from "ws"

let ws
let sessionContext = []

export function connectRealtime(onResponse) {

  ws = new WebSocket("wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview", {
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
    }
  })

  ws.on("open", () => {
    console.log("Realtime connected.")
  })

  ws.on("message", (data) => {
    const msg = JSON.parse(data.toString())

    if (msg.type === "response.output_text.delta") {
      onResponse(msg.delta)
    }
  })

  ws.on("error", console.error)
}

export function sendAudioChunk(base64Audio) {
  ws.send(JSON.stringify({
    type: "input_audio_buffer.append",
    audio: base64Audio
  }))
}

export function commitAudio() {
  ws.send(JSON.stringify({
    type: "input_audio_buffer.commit"
  }))
}
