import { REST } from "@discordjs/rest";
import { Routes } from "discord.js";
import "dotenv/config";

const commands = [
  {
    name: "setel",
    description: "Setel lagu apa ni?",
    options: [
      {
        name: "judul",
        type: 3,
        description: "Judul lagu yang mau disetel",
        required: true,
      },
    ],
  },
  {
    name: "pause",
    description: "Pause lagu sementara",
    type: 1,
  },
  {
    name: "stop",
    description: "Stop lagu yang lagi disetel, hapus semua isi playlist",
    type: 1,
  },
  {
    name: "skip",
    description: "Skip lagu yang kamu gamau setel",
    type: 1,
  },
  {
    name: "queue",
    description: "Lihat lagu apa aja yang masuk playlist",
    type: 1,
  },
  {
    name: "resume",
    description: "Lanjutin lagu yang di pause",
    type: 1,
  },
  {
    name: "shuffle",
    description: "Acak lagu lagu yang di pause",
    type: 1,
  },
];

async function setServer() {
  try {
    if (!process.env.DISCORD_TOKEN) throw Error("Cannot get discord token");
    if (!process.env.APPLICATION_ID) throw Error("Cannot get application id");
    if (!process.env.GUILD_ID) throw Error("Cannot get guild id");
    const rest = new REST().setToken(process.env.DISCORD_TOKEN);
    console.log("Started refreshing application [/] commands.");
    await rest.put(Routes.applicationGuildCommands(process.env.APPLICATION_ID, process.env.GUILD_ID), { body: commands });
    console.log("Successfully reloaded application [/] commands.");
  } catch (error) {
    console.error(error);
  }
}

setServer();
