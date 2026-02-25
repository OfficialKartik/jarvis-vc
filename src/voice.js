import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  StreamType,
  getVoiceConnection,
  EndBehaviorType
} from "@discordjs/voice";
import prism from "prism-media";
import WebSocket from "ws";
import { PassThrough } from "stream";

let connection, player, ws, active = false, realtimeReady = false;

export async function startVoiceSession(channel) {
  if (active) return;
  active = true;

  connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator
  });

  player = createAudioPlayer();
  connection.subscribe(player);

  // Note: Ensure model name is "gpt-4o-realtime-preview" as gpt-realtime-1.5 is not a standard slug
  ws = new WebSocket("wss://://api.openai.com", {
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "OpenAI-Beta": "realtime=v1"
    }
  });

  ws.on("open", () => {
    console.log("Realtime connected.");
    realtimeReady = true;
    ws.send(JSON.stringify({
      type: "session.update",
      session: {
        modalities: ["audio", "text"],
        instructions: "Respond in Hindi in a natural human tone.",
        turn_detection: { type: "server_vad" }, // Let OpenAI handle the silence
        input_audio_format: "pcm16",
        output_audio_format: "pcm16",
        input_audio_transcription: { model: "whisper-1" }
      }
    }));
  });

  // ===== PLAYBACK PIPELINE (AI -> Discord) =====
  let inputStream = null;

  ws.on("message", (data) => {
    const msg = JSON.parse(data.toString());

    if (msg.type === "response.audio.delta") { // Correct event for audio chunks
      if (!inputStream || inputStream.destroyed) {
        inputStream = new PassThrough();
        
        const ffmpeg = new prism.FFmpeg({
          args: [
            "-f", "s16le", "-ar", "24000", "-ac", "1", "-i", "pipe:0",
            "-f", "s16le", "-ar", "48000", "-ac", "2", "pipe:1"
          ]
        });

        const resource = createAudioResource(inputStream.pipe(ffmpeg), {
          inputType: StreamType.Raw
        });
        player.play(resource);
      }
      inputStream.write(Buffer.from(msg.delta, "base64"));
    }

    if (msg.type === "response.done") {
        if (inputStream) inputStream.end();
        inputStream = null;
    }
  });

  // ===== INPUT CAPTURE (User -> AI) =====
  connection.receiver.speaking.on("start", (userId) => {
    if (!realtimeReady) return;

    const opusStream = connection.receiver.subscribe(userId, {
      end: { behavior: EndBehaviorType.AfterSilence, duration: 1000 }
    });

    // Transcode Discord (48kHz Stereo) to OpenAI (24kHz Mono)
    const filter = new prism.FFmpeg({
      args: [
        "-f", "s16le", "-ar", "48000", "-ac", "2", "-i", "pipe:0",
        "-f", "s16le", "-ar", "24000", "-ac", "1", "pipe:1"
      ]
    });

    const pcmStream = opusStream.pipe(new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 })).pipe(filter);

    pcmStream.on("data", (chunk) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: "input_audio_buffer.append",
          audio: chunk.toString("base64")
        }));
      }
    });
  });
}

export function stopVoiceSession() {
  if (ws) ws.close();
  if (connection) connection.destroy();
  active = false;
  realtimeReady = false;
}
