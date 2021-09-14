require("dotenv").config();
const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v9");

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
    type: 1
  },
  {
    name: "skip",
    description: "Skip lagu yang kamu gamau setel",
    type: 1
  },
  {
    name: "queue",
    description: "Lihat lagu apa aja yang masuk playlist",
    type: 1
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

const rest = new REST({ version: "9" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log("Started refreshing application [/] commands.");

    await rest.put(
      Routes.applicationGuildCommands(
        "887228728512491580",
        "695217479139590177"
      ),
      { body: commands }
    );

    console.log("Successfully reloaded application [/] commands.");
  } catch (error) {
    console.error(error);
  }
})();
