import { GuildQueue, Player } from "discord-player";
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

player.extractors.loadDefault((ext) => ext === "YouTubeExtractor");

player.events.on("playerStart", async (queue, track) => {
  if (!queue.metadata) throw "metadata not defined";
  const metadata = queue.metadata as Interaction;
  await metadata.channel?.send(`Now playing **${track.title}**!`);
  logger.info({ track }, "playerStart");
});

player.events.on("audioTrackAdd", (queue, track) => logger.debug({ track }, "audioTrackAdd"));

player.events.on("playerFinish", (queue, track) => logger.debug({ track }, "playerFinish"));

player.events.on("connection", (queue) => logger.debug("connection"));

player.events.on("connectionDestroyed", (queue) => logger.error("connectionDestroyed"));

player.events.on("debug", (queue, data) => logger.debug({ debug: data }));

player.events.on("emptyQueue", (queue) => logger.debug("emptyQueue"));

player.events.on("emptyChannel", (queue) => logger.debug("emptyChannel"));

player.events.on("audioTracksAdd", (queue) => logger.debug("audioTracksAdd"));

player.events.on("playerSkip", (queue, track, reason, description) =>
  logger.debug({ queue: queue.tracks.toArray(), track, reason, description }, "playerSkip")
);

client.once("ready", () => {
  logger.info(`Logged in as ${client.user?.tag}`);
});

player.on("error", (error) => {
  logger.error({ message: error.message, detail: error.name, stack: error.stack });
});

player.events.on("error", (queue, error) => {
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

    const queue = player.queues.create(guild, {
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
      queue.delete();
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
    logger.debug({ isplaying: queue.isPlaying(), isrunning: queue.isPlaying() === false });
    if (queue.isPlaying() === false) await queue.play(track);

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

    player.queues.delete(guild);

    await interaction.reply({
      content: "Udah distop ya sayang",
    });
    return;
  }

  // skip music
  if (interaction.commandName === "skip") {
    let queue: GuildQueue | null;
    try {
      queue = await getGuildQueue(interaction);
    } catch (error) {
      logger.error((error as Error).message);
      return;
    }
    if (!queue || !queue.isPlaying()) {
      await interaction.reply({
        content: "Lagi gada lagu kamu skip gimana si",
      });
      return;
    }

    const currentTrack = queue.currentTrack;
    const success = await queue.node.skip();
    await interaction.reply({
      content: success ? `Lagu **${currentTrack}** aku skip ya` : "❌ | Ada ngaco ni, bloon yang buat",
    });

    console.log({ queue: queue.tracks.toArray() });
    return;
  }

  // show queue
  if (interaction.commandName == "queue") {
    const guild = validateGuild(interaction);
    const queue = player.queues.get(guild);
    if (!queue || !queue.isPlaying()) {
      await interaction.reply({ content: "Isi playlist kosong ni" });
      return;
    }

    console.log({ queue: queue.tracks });

    const currentTrack = queue.tracks.toArray();
    const tracks = currentTrack.slice(0, 10).map((m, i) => {
      return `${i + 1}. **${m.title}** ([link](${m.url}))`;
    });

    await interaction.reply({
      embeds: [
        {
          title: "Isi playlist",
          description: `${tracks.join("\n")}${
            currentTrack.length > tracks.length
              ? `\n...${
                  currentTrack.length - tracks.length === 1
                    ? `${currentTrack.length - tracks.length} more track`
                    : `${currentTrack.length - tracks.length} more tracks`
                }`
              : ""
          }`,
          color: 0xff0000,
          fields: [{ name: "Now Playing", value: `🎶 | **${currentTrack}** ([link](${currentTrack}))` }],
        },
      ],
    });
    return;
  }

  // pause music
  if (interaction.commandName === "pause") {
    const queue = await getGuildQueue(interaction);
    if (!queue || !queue.isPlaying()) {
      await interaction.reply({
        content: "Lagi gada lagu kamu pause suka aneh",
      });
      return;
    }
    const currentTrack = queue.currentTrack;
    const success = queue.node.pause();
    await interaction.reply({
      content: success ? `Lagu **${currentTrack}** aku pause ya` : "❌ | Ada ngaco ni, bloon yang buat",
    });
    return;
  }

  // resume music
  if (interaction.commandName === "resume") {
    const queue = await getGuildQueue(interaction);
    if (!queue || !queue.isPlaying()) {
      await interaction.reply({
        content: "Lagi gada lagu kamu lanjut suka aneh",
      });
      return;
    }
    const currentTrack = queue.currentTrack;
    const success = queue.node.resume();
    await interaction.reply({
      content: success ? `Lagu **${currentTrack}** aku lanjut ya` : "❌ | Ada ngaco ni, bloon yang buat",
    });
    return;
  }

  // shuffle music
  if (interaction.commandName === "shuffle") {
    const queue = await getGuildQueue(interaction);
    if (!queue || !queue.isPlaying()) {
      await interaction.reply({
        content: "Lagi gada lagu kamu mau shuffle ga sekalian parkour bang?",
      });
      return;
    }

    queue.tracks.shuffle();
    await interaction.reply({
      content: `Playlist aku shuffle ya`,
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

async function getGuildQueue(interaction: CommandInteraction): Promise<GuildQueue | null> {
  const guild = validateGuild(interaction);
  await checkVoiceChannelValidity(interaction);
  return player.queues.get(guild);
}
