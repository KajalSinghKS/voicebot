import { WebSocketServer } from 'ws';

import { generateResponse } from "../genai/server.js";

const wss = new WebSocketServer({ port: 8080 });

wss.on("connection", ws => {
  console.log("Client connected");

  ws.on("message", async message => {
    try {
      const { text } = JSON.parse(message);
      const reply = await generateResponse(text);
      ws.send(reply);
    } catch (err) {
      console.error("Error generating response:", err);
      ws.send("Sorry, something went wrong.");
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
  });
});