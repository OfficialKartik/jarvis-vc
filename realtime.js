import WebSocket from "ws"

export function createRealtimeSession() {
  const ws = new WebSocket(
    "wss://api.openai.com/v1/realtime?model=" + process.env.REALTIME_MODEL,
    {
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "OpenAI-Beta": "realtime=v1"
      }
    }
  )

  ws.on("open", () => {
    console.log("Realtime connected.")
  })

  ws.on("message", (msg) => {
    const data = JSON.parse(msg.toString())

    if (data.type === "response.output_text.delta") {
      process.stdout.write(data.delta)
    }
  })

  ws.on("close", () => {
    console.log("Realtime closed.")
  })

  return ws
}
