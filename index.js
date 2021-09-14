require("dotenv").config();
const { Client, Intents } = require("discord.js");
const client = new Client({
  intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_VOICE_STATES],
});
const { Player } = require("discord-player");

// Create a new Player (you don't need any API Key)
const player = new Player(client);

// add the trackStart event so when a song will be played this message will be sent
player.on("trackStart", (queue, track) => queue.metadata.channel.send(`Now playing **${track.title}**!`));

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

player.on("error", (queue, error) => {
  queue.metadata.channel.send(`Adu maap error nih, antara lagunya error ato yang bikin emang bloon`);
  console.log({ message: error.message, detail: error.name, stack: error.stack });
});

player.on("debug", (queue, message) => {
  console.log(message);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  // play music
  if (interaction.commandName === "setel") {
    if (!interaction.member.voice.channelId)
      return await interaction.reply({
        content: "Ga di voice channel sayang",
        ephemeral: true,
      });
    if (interaction.guild.me.voice.channelId && interaction.member.voice.channelId !== interaction.guild.me.voice.channelId)
      return await interaction.reply({
        content: "Beda voice channel sayang",
        ephemeral: true,
      });
    const query = interaction.options.get("judul").value;

    const queue = player.createQueue(interaction.guild, {
      metadata: {
        channel: interaction.channel,
      },
    });

    // verify vc connection
    try {
      if (!queue.connection) await queue.connect(interaction.member.voice.channel);
    } catch {
      queue.destroy();
      return await interaction.reply({
        content: "Gabisa masuk voice channel nih",
        ephemeral: true,
      });
    }

    await interaction.deferReply();
    const track = await player
      .search(query, {
        requestedBy: interaction.user,
      })
      .then((x) => x.tracks[0]);
    if (!track)
      return await interaction.followUp({
        content: `Wadu, lagu **${query}** engga ketemu`,
      });

    queue.addTrack(track);
    if (!queue.playing) queue.play();

    return await interaction.followUp({
      content: `Ketemu ni **${track.title}**`,
    });
  }

  if (interaction.commandName === "stop") {
    if (!interaction.member.voice.channelId)
      return await interaction.reply({
        content: "Ga di voice channel sayang",
        ephemeral: true,
      });
    if (interaction.guild.me.voice.channelId && interaction.member.voice.channelId !== interaction.guild.me.voice.channelId)
      return await interaction.reply({
        content: "Beda voice channel sayang",
        ephemeral: true,
      });

    player.deleteQueue(interaction.guild);

    return await interaction.reply({
      content: "Udah distop ya sayang",
    });
  }

  if (interaction.commandName === "skip") {
    if (!interaction.member.voice.channelId)
      return await interaction.reply({
        content: "Ga di voice channel sayang",
        ephemeral: true,
      });
    if (interaction.guild.me.voice.channelId && interaction.member.voice.channelId !== interaction.guild.me.voice.channelId)
      return await interaction.reply({
        content: "Beda voice channel sayang",
        ephemeral: true,
      });

    const queue = player.getQueue(interaction.guild);
    if (!queue || !queue.playing)
      return await interaction.reply({
        content: "Lagi gada lagu kamu skip gimana si",
      });
    const currentTrack = queue.current;
    const success = queue.skip();
    return await interaction.reply({
      content: success ? `Lagu **${currentTrack}** aku skip ya` : "❌ | Ada ngaco ni, bloon yang buat",
    });
  }

  if (interaction.commandName == "queue") {
    const queue = player.getQueue(interaction.guild);
    if (!queue || !queue.playing) {
      return await interaction.reply({ content: "Isi playlist kosong ni" });
    }
    const currentTrack = queue.current;
    const tracks = queue.tracks.slice(0, 10).map((m, i) => {
      return `${i + 1}. **${m.title}** ([link](${m.url}))`;
    });

    return await interaction.reply({
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
  }

  if (interaction.commandName === "pause") {
    if (!interaction.member.voice.channelId)
      return await interaction.reply({
        content: "Ga di voice channel sayang",
        ephemeral: true,
      });
    if (interaction.guild.me.voice.channelId && interaction.member.voice.channelId !== interaction.guild.me.voice.channelId)
      return await interaction.reply({
        content: "Beda voice channel sayang",
        ephemeral: true,
      });

    const queue = player.getQueue(interaction.guild);
    if (!queue || !queue.playing)
      return await interaction.reply({
        content: "Lagi gada lagu kamu pause suka aneh",
      });
    const currentTrack = queue.current;
    const success = queue.setPaused(true);
    return await interaction.reply({
      content: success ? `Lagu **${currentTrack}** aku pause ya` : "❌ | Ada ngaco ni, bloon yang buat",
    });
  }

  if (interaction.commandName === "resume") {
    if (!interaction.member.voice.channelId)
      return await interaction.reply({
        content: "Ga di voice channel sayang",
        ephemeral: true,
      });
    if (interaction.guild.me.voice.channelId && interaction.member.voice.channelId !== interaction.guild.me.voice.channelId)
      return await interaction.reply({
        content: "Beda voice channel sayang",
        ephemeral: true,
      });

    const queue = player.getQueue(interaction.guild);
    if (!queue || !queue.playing)
      return await interaction.reply({
        content: "Lagi gada lagu kamu lanjut suka aneh",
      });
    const currentTrack = queue.current;
    const success = queue.setPaused(false);
    return await interaction.reply({
      content: success ? `Lagu **${currentTrack}** aku lanjut ya` : "❌ | Ada ngaco ni, bloon yang buat",
    });
  }

  if (interaction.commandName === "shuffle") {
    if (!interaction.member.voice.channelId)
      return await interaction.reply({
        content: "Ga di voice channel sayang",
        ephemeral: true,
      });
    if (interaction.guild.me.voice.channelId && interaction.member.voice.channelId !== interaction.guild.me.voice.channelId)
      return await interaction.reply({
        content: "Beda voice channel sayang",
        ephemeral: true,
      });

    const queue = player.getQueue(interaction.guild);
    if (!queue || !queue.playing)
      return await interaction.reply({
        content: "Lagi gada lagu kamu mau shuffle ga sekalian parkour bang?",
      });

    const success = queue.shuffle();
    return await interaction.reply({
      content: success ? `Playlist aku shuffle ya` : "❌ | Ada ngaco ni, bloon yang buat",
    });
  }
});
client.login(process.env.DISCORD_TOKEN);
