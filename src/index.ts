import { Player, Queue } from "discord-player";
import { Client, CommandInteraction, GatewayIntentBits, Guild, GuildMember } from "discord.js";
import "dotenv/config";
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildVoiceStates],
});

client.login(process.env.DISCORD_TOKEN);

// Create a new Player (you don't need any API Key)
const player = new Player(client);

player.on("trackStart", (queue, track) => console.log(typeof queue.metadata));

client.once("ready", () => {
  console.log(`Logged in as ${client.user?.tag}`);
});

player.on("error", (queue, error) => {
  console.error("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
  console.error(typeof queue.metadata);
  // queue.metadata.channel.send(`Adu maap error nih, antara lagunya error ato yang bikin emang bloon`);
  console.log({ message: error.message, detail: error.name, stack: error.stack });
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  // play music
  if (interaction.commandName === "setel") {
    const guild = validateGuild(interaction);
    await checkVoiceChannelValidity(interaction);

    const query = interaction.options.get("judul")?.value;
    if (typeof query !== "string") throw "Gagal nih process judulnya";

    const queue = player.createQueue(guild, {
      metadata: {
        channel: interaction.channel,
      },
      ytdlOptions: {
        filter: "audioonly",
        quality: "highestaudio",
        highWaterMark: 1 << 25,
        dlChunkSize: 0,
      },
    });

    const sender = await guild.members.fetch({
      user: interaction.user,
    });

    // verify vc connection
    try {
      if (!queue.connection) await queue.connect(sender.voice.channel!);
    } catch {
      queue.destroy();
      await interaction.reply({
        content: "Gabisa masuk voice channel nih",
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();
    const searchResult = await player.search(query, { requestedBy: sender });
    if (searchResult.tracks.length === 0) {
      await interaction.followUp({
        content: `Wadu, lagu **${query}** engga ketemu`,
      });
      return;
    }

    const trackName = searchResult.tracks[0];
    await queue.addTrack(trackName);
    if (!queue.playing) queue.play();

    await interaction.followUp({
      content: `Ketemu ni **${trackName}**`,
    });
    return;
  }

  // stop music
  if (interaction.commandName === "stop") {
    const guild = validateGuild(interaction);
    await checkVoiceChannelValidity(interaction);

    player.deleteQueue(guild);

    await interaction.reply({
      content: "Udah distop ya sayang",
    });
    return;
  }

  // skip music
  if (interaction.commandName === "skip") {
    const queue = await getGuildQueue(interaction);
    if (!queue || !queue.playing) {
      await interaction.reply({
        content: "Lagi gada lagu kamu skip gimana si",
      });
      return;
    }

    const currentTrack = queue.current;
    const success = queue.skip();
    await interaction.reply({
      content: success ? `Lagu **${currentTrack}** aku skip ya` : "❌ | Ada ngaco ni, bloon yang buat",
    });
    return;
  }

  // show queue
  if (interaction.commandName == "queue") {
    const guild = validateGuild(interaction);
    const queue = player.getQueue(guild);
    if (!queue || !queue.playing) {
      await interaction.reply({ content: "Isi playlist kosong ni" });
    }

    const currentTrack = queue.current;
    const tracks = queue.tracks.slice(0, 10).map((m, i) => {
      return `${i + 1}. **${m.title}** ([link](${m.url}))`;
    });

    await interaction.reply({
      embeds: [
        {
          title: "Isi playlist",
          description: `${tracks.join("\n")}${
            queue.tracks.length > tracks.length
              ? `\n...${
                  queue.tracks.length - tracks.length === 1
                    ? `${queue.tracks.length - tracks.length} more track`
                    : `${queue.tracks.length - tracks.length} more tracks`
                }`
              : ""
          }`,
          color: 0xff0000,
          fields: [{ name: "Now Playing", value: `🎶 | **${currentTrack.title}** ([link](${currentTrack.url}))` }],
        },
      ],
    });
    return;
  }

  // pause music
  if (interaction.commandName === "pause") {
    const queue = await getGuildQueue(interaction);
    if (!queue || !queue.playing) {
      await interaction.reply({
        content: "Lagi gada lagu kamu pause suka aneh",
      });
      return;
    }
    const currentTrack = queue.current;
    const success = queue.setPaused(true);
    await interaction.reply({
      content: success ? `Lagu **${currentTrack}** aku pause ya` : "❌ | Ada ngaco ni, bloon yang buat",
    });
    return;
  }

  // resume music
  if (interaction.commandName === "resume") {
    const queue = await getGuildQueue(interaction);
    if (!queue || !queue.playing) {
      await interaction.reply({
        content: "Lagi gada lagu kamu lanjut suka aneh",
      });
      return;
    }
    const currentTrack = queue.current;
    const success = queue.setPaused(false);
    await interaction.reply({
      content: success ? `Lagu **${currentTrack}** aku lanjut ya` : "❌ | Ada ngaco ni, bloon yang buat",
    });
    return;
  }

  // shuffle music
  if (interaction.commandName === "shuffle") {
    const queue = await getGuildQueue(interaction);
    if (!queue || !queue.playing) {
      await interaction.reply({
        content: "Lagi gada lagu kamu mau shuffle ga sekalian parkour bang?",
      });
      return;
    }

    const success = queue.shuffle();
    await interaction.reply({
      content: success ? `Playlist aku shuffle ya` : "❌ | Ada ngaco ni, bloon yang buat",
    });
    return;
  }
});

async function checkVoiceChannelValidity(interaction: CommandInteraction): Promise<void> {
  const memberVoice = (interaction.member as GuildMember).voice;
  if (!interaction.inGuild()) throw Error("Not in guild");
  const guild = interaction.guild;
  if (!memberVoice.channelId) {
    await interaction.reply({
      content: "Ga di voice channel sayang",
      ephemeral: true,
    });
    return;
  }
  if (guild?.members.me?.voice.channelId && memberVoice.channelId !== guild.members.me.voice.channelId) {
    await interaction.reply({
      content: "Beda voice channel sayang",
      ephemeral: true,
    });
  }
}

function validateGuild(interaction: CommandInteraction): Guild {
  const guild = interaction.guild;
  if (!guild) throw Error("Gagal nih process guild nya");
  return guild;
}

async function getGuildQueue(interaction: CommandInteraction): Promise<Queue | undefined> {
  const guild = validateGuild(interaction);
  await checkVoiceChannelValidity(interaction);
  return player.getQueue(guild);
}
