import { Player, Queue } from "discord-player";
import { Client, CommandInteraction, GatewayIntentBits, Guild, GuildMember, Interaction, VoiceBasedChannel } from "discord.js";
import "dotenv/config";
import { pino } from "pino";
import * as playdl from "play-dl";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
});

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildVoiceStates],
});

client.login(process.env.DISCORD_TOKEN);

// Create a new Player (you don't need any API Key)
const player = new Player(client);

player.on("trackStart", async (queue, track) => {
  if (!queue.metadata) throw "metadata not defined";
  const metadata = queue.metadata as Interaction;
  await metadata.channel?.send(`Now playing **${track.title}**!`);
  logger.info({ track }, "trackStart");
});

player.on("trackAdd", (queue, track) => logger.debug({ track }, "trackAdd"));

player.on("trackEnd", (queue, track) => logger.debug({ track }, "trackEnd"));

player.on("connectionCreate", (queue, stream) => logger.debug({ stream }, "connectionCreate"));

player.on("connectionError", (queue, err) => logger.error({ err }, "connectionError"));

player.on("debug", (queue, data) => logger.debug({ data }, "debug"));

player.on("queueEnd", (queue) => logger.debug("queueEnd"));

player.on("channelEmpty", (queue) => logger.debug("channelEmpty"));

player.on("tracksAdd", (queue) => logger.debug("tracksAdd"));

client.once("ready", () => {
  logger.info(`Logged in as ${client.user?.tag}`);
});

player.on("error", (queue, error) => {
  if (!queue.metadata) throw "metadata not defined";
  const metadata = queue.metadata as Interaction;
  metadata.channel?.send(`Adu maap error nih, antara lagunya error ato yang bikin emang bloon`);
  logger.error({ message: error.message, detail: error.name, stack: error.stack });
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  // play music
  if (interaction.commandName === "setel") {
    let guild: Guild;
    let voiceChannel: VoiceBasedChannel;
    try {
      guild = validateGuild(interaction);
      voiceChannel = await checkVoiceChannelValidity(interaction);
    } catch (error) {
      logger.error((error as Error).message);
      return;
    }

    const query = interaction.options.get("judul")?.value;
    if (typeof query !== "string") throw "Gagal nih process judulnya";

    const queue = player.createQueue(guild, {
      metadata: {
        channel: interaction.channel,
      },
      async onBeforeCreateStream(track, source, queue) {
        return (await playdl.stream(track.url, { discordPlayerCompatibility: true })).stream;
      },
    });

    const sender = await guild.members.fetch({
      user: interaction.user,
    });

    // verify vc connection
    try {
      if (!queue.connection) await queue.connect(voiceChannel);
    } catch {
      queue.destroy();
      await interaction.reply({
        content: "Gabisa masuk voice channel nih",
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();
    const track = await player.search(query, { requestedBy: sender }).then((x) => x.tracks[0]);
    if (!track) {
      await interaction.followUp({
        content: `Wadu, lagu **${query}** engga ketemu`,
      });
      return;
    }

    await queue.addTrack(track);
    logger.debug({ isplaying: queue.playing, isrunning: queue.playing === false });
    if (queue.playing === false) await queue.play();

    await interaction.followUp({
      content: `Ketemu ni **${track}**`,
    });
    return;
  }

  // stop music
  if (interaction.commandName === "stop") {
    let guild: Guild;
    try {
      guild = validateGuild(interaction);
      await checkVoiceChannelValidity(interaction);
    } catch (error) {
      logger.error((error as Error).message);
      return;
    }

    player.deleteQueue(guild);

    await interaction.reply({
      content: "Udah distop ya sayang",
    });
    return;
  }

  // skip music
  if (interaction.commandName === "skip") {
    let queue: Queue | undefined;
    try {
      queue = await getGuildQueue(interaction);
    } catch (error) {
      logger.error((error as Error).message);
      return;
    }
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
      return;
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

async function checkVoiceChannelValidity(interaction: CommandInteraction): Promise<VoiceBasedChannel> {
  const memberVoice = (interaction.member as GuildMember).voice;
  if (!interaction.inGuild()) throw Error("Not in guild");
  const guild = interaction.guild;
  if (!memberVoice.channelId || !memberVoice.channel) {
    await interaction.reply({
      content: "Ga di voice channel sayang",
      ephemeral: true,
    });
    throw Error("Member not in voice channel");
  }
  if (guild?.members.me?.voice.channelId && memberVoice.channelId !== guild.members.me.voice.channelId) {
    await interaction.reply({
      content: "Beda voice channel sayang",
      ephemeral: true,
    });
    throw Error("Different voice channel");
  }
  return memberVoice.channel;
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
