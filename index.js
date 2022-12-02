const { Client, GuildMember, Intents, GatewayIntentBits } = require("discord.js");
const { Player, QueryType } = require("discord-player");

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates]
});

require('dotenv').config();

const player = new Player(client);

client.login(process.env.DISCORD_TOKEN);

client.on('ready', () => {
    console.log('Ready!');
   });

client.on('messageCreate', async (message)=>{

    if(message.content==='ping'){
        message.reply('test')
    }
    else if(message.content.includes('gay')){
        message.reply('no u')
    }
    else if(message.content.includes('u suck')){
        message.reply('dicks :eggplant: ')
    }
    else if(message.content.includes('dick')){
        message.reply('cheese :cheese:')
    }
    else if(message.content.includes('pokemon')){
        message.reply('is shit :upside_down: ')
    }
    else if(message.content.includes('bob')){
        message.reply('the mighty :banana: ')
    }

    if (message.author.bot || !message.guild) return;
    if (!client.application?.owner) await client.application?.fetch();

    if (message.content === "!deploy" && message.author.id === client.application?.owner?.id) {
        await message.guild.commands.set([
            {
                name: "bob",
                description: "Plays a song from youtube",
                options: [
                    {
                        name: "query",
                        type: 3,
                        description: "The song you want to play",
                        required: true
                    }
                ]
            },
            {
                name: "skip",
                description: "Skip to the current song"
            },
            {
                name: "queue",
                description: "See the queue"
            },
            {
                name: "stop",
                description: "Stop the player"
            },
            {
                name: "fuckoff",
                description: "player leave"
            },
        ]);

        await message.reply("Deployed!");
    }

})

client.on("interactionCreate", async (interaction) => {
    //if (!interaction.isCommand() || !interaction.guildId) return;


    if (interaction.commandName === "bob") {
        await interaction.deferReply();

        const query = interaction.options.get("query").value;
        const searchResult = await player
            .search(query, {
                requestedBy: interaction.user,
                searchEngine: QueryType.AUTO
            })
            //.catch(() => {});
        if (!searchResult || !searchResult.tracks.length) return void interaction.followUp({ content: "No results were found!" });

        const queue = player.createQueue(interaction.guild, {
            metadata: interaction.channel,
        });

        try {
            if (!queue.connection) await queue.connect(interaction.member.voice.channel);
        } catch {
            void player.deleteQueue(interaction.guildId);
            return void interaction.followUp({ content: "Could not join your voice channel!" });
        }

        await interaction.followUp({ content: `⏱ | Loading your ${searchResult.playlist ? "playlist" : "track"}...` });
        searchResult.playlist ? queue.addTracks(searchResult.tracks) : queue.addTrack(searchResult.tracks[0]);
        if (!queue.playing) await queue.play();

        console.log(searchResult.tracks)


    } else if (interaction.commandName === "skip") {
        await interaction.deferReply();
        const queue = player.getQueue(interaction.guildId);
        if (!queue || !queue.playing) return void interaction.followUp({ content: "❌ | No music is being played!" });
        const currentTrack = queue.current;
        const success = queue.skip();
        return void interaction.followUp({
            content: success ? `✅ | Skipped **${currentTrack}**!` : "❌ | Something went wrong!"
        });
    } else if (interaction.commandName === "stop") {
        await interaction.deferReply();
        const queue = player.getQueue(interaction.guildId);
        if (!queue || !queue.playing) return void interaction.followUp({ content: "❌ | No music is being played!" });
        queue.destroy();
        return void interaction.followUp({ content: "🛑 | Stopped the player!" });

    }else if(interaction.commandName === "fuckoff"){
        await interaction.deferReply();
        const queue = player.getQueue(interaction.guildId);
        queue.destroy();
        await interaction.followUp({ content: "cry ;-;" });
    } 
    else {
        interaction.reply({
            content: "Unknown command!",
            ephemeral: true
        });
    }
});
   
   client.on("error", console.error);
   client.on("warn", console.warn);




player.on("error", (queue, error) => {
    console.log(`[${queue.guild.name}] Error emitted from the queue: ${error.message}`);
});
player.on("connectionError", (queue, error) => {
    console.log(`[${queue.guild.name}] Error emitted from the connection: ${error.message}`);
});

player.on("trackStart", (queue, track) => {
    queue.metadata.send(`🎶 | Started playing: **${track.title}** in **${queue.connection.channel.name}**!`);
});

player.on("trackAdd", (queue, track) => {
    queue.metadata.send(`🎶 | Track **${track.title}** queued!`);
});

player.on("botDisconnect", (queue) => {
    queue.metadata.send("❌ | I was manually disconnected from the voice channel, clearing queue!");
});

player.on("channelEmpty", (queue) => {
    queue.metadata.send("❌ | Nobody is in the voice channel, leaving...");
});

player.on("queueEnd", (queue) => {
    queue.metadata.send("✅ | Queue finished!");
});