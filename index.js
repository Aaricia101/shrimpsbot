const { Client, GuildMember, Intents, GatewayIntentBits } = require("discord.js");
const { Player, QueryType } = require("discord-player");
const Discord = require("discord.js");
const { createAudioPlayer, createAudioResource, NoSubscriberBehavior, StreamType, entersState, VoiceConnectionStatus, getVoiceConnection , joinVoiceChannel } = require('@discordjs/voice');
const client = new Discord.Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates]
});
require('dotenv').config();

const ytdl = require("@distube/ytdl-core");

const prefix = "!"
const Bottleneck = require('bottleneck');
var serverQueue = ""
const queue = new Map();
const fs = require('fs');

//limiter to avoid being flagged by youtube bot blocker
const limiter = new Bottleneck({
    maxConcurrent: 1,
    minTime: 1000 
});

const path = require("path");

const directory = "Music";


client.login(process.env.DISCORD_TOKEN);

client.on('ready', () => {
    console.log('Ready!');
    fs.readdir(directory, (err, files) => {
        if (err) throw err;

        for (const file of files) {
            fs.unlink(path.join(directory, file), (err) => {
                if (err) throw err;
            });
        }
    });

});


client.once("reconnecting", () => {
    console.log("Reconnecting!");
});

client.once("disconnect", () => {
    console.log("Disconnect!");

});

client.on("messageCreate", async message => {

    console.log("yesss")

    //custom messages
    if (message.content === 'ping') {
        message.reply('test')
    }
    if (message.content.toLowerCase().includes('pokemon')) {
        message.reply('is cool')
    }
    if (message.content.toLowerCase().includes('bob')) {
        message.reply('the mighty')
    }
    if (message.content.toLowerCase().includes('subway')) {
        message.reply('12 inches is not enough')
    }
    if (message.content.toLowerCase().includes('eduardo')) {
        message.reply('is suffering with derivatives')
    }
    if (message.content.toLowerCase().includes('chinese')) {
        message.reply('Jo\'s girlfriend?')
    }
    if (message.content.toLowerCase().includes('mom')) {
        message.reply('Hide them from Jo')
    }
    if (message.content.toLowerCase().includes('daphné')) {
        message.reply('Est admireur de Shrek')
    }
    if (message.content.toLowerCase().includes('hotel')) {
        message.reply('Trivago')
    }


    if (message.author.bot) return;
    if (!message.content.startsWith(prefix)) return;

    serverQueue = queue.get(message.guild.id);

    if (!serverQueue) {
        // Initialize the queue for this guild
        const queueConstruct = {
            textChannel: message.channel,
            voiceChannel: message.member.voice.channel,
            connection: null,
            songs: [],
            audioPlayer: createAudioPlayer(),
            volume: 5,
            playing: true
        };
        queue.set(message.guild.id, queueConstruct);
    }


    //prefix can be changed
    if (message.content.startsWith(`${prefix}play`)) {
        execute(message, serverQueue);
        return;
    } else if (message.content.startsWith(`${prefix}skip`)) {
        skip(message, serverQueue);
        return;
    } else if (message.content.startsWith(`${prefix}stop`)) {
        stop(message, serverQueue);
        return;
    } else {
        message.channel.send("You need to enter a valid command!");
    }
});
const getVideoInfo = limiter.wrap(async (url) => {
    const songInfo = await ytdl.getInfo(url);
    return {
        title: songInfo.videoDetails.title,
        url: songInfo.videoDetails.video_url
    };
});
async function execute(message, serverQueue) {
    const args = message.content.split(" ");

    try {
        const song = await getVideoInfo(args[1]);

        if (!serverQueue) {
            //set queue
            const queueConstruct = {
                textChannel: message.channel,
                voiceChannel: message.member.voice.channel,
                connection: null,
                songs: [],
                audioPlayer: createAudioPlayer(),
                volume: 5,
                playing: true
            };
            queue.set(message.guild.id, queueConstruct);
            queueConstruct.songs.push(song);

            try {
                //join VC
                const connection = joinVoiceChannel({
                    channelId: message.member.voice.channel.id,
                    guildId: message.guild.id,
                    adapterCreator: message.guild.voiceAdapterCreator
                });
                queueConstruct.connection = connection;
                connection.subscribe(queueConstruct.audioPlayer);
                play(message.guild, queueConstruct.songs[0]);

            } catch (err) {
                console.error(err);
                queue.delete(message.guild.id);
                return message.channel.send(err.message);
            }
        } else {
            serverQueue.songs.push(song);
            return message.channel.send(`${song.title} has been added to the queue!`);
        }
    } catch (error) {
        console.error('Error fetching video info:', error);
        return message.channel.send('Failed to process the YouTube URL');
    }
}

//skip current song and move to the next
function skip(message, serverQueue) {
    if (!message.member.voice.channel)
        return message.channel.send("You have to be in a voice channel to skip the music!");
    if (!serverQueue)
        return message.channel.send("There is no song to skip!");


    serverQueue.textChannel.send(`🎵 Now Skipping: **${serverQueue.songs[0].title}**`);
    serverQueue.audioPlayer.stop(); // Stop the current song
}

//stop music and quit the VC
function stop(message, serverQueue) {
    if (!message.member.voice.channel) {
        return message.channel.send("You have to be in a voice channel to stop the music!");
    }

    //if there's no songs
    if (!serverQueue || serverQueue.songs.length === 0) {
        const connection = getVoiceConnection(message.guild.id);
        if (connection) {
            connection.destroy(); 
            return message.channel.send("Ciao byeee!");
        } else {
            return message.channel.send("No active voice connection to stop!");
        }
    }

  
    //if there are songs
    serverQueue.songs = []; // Clear the queue
    serverQueue.audioPlayer.stop(); // Stop playback

    
    message.channel.send(`Ciao byeee!`);
    serverQueue.connection.destroy(); 

    // Delete the queue from memory
    queue.delete(message.guild.id);
}

async function play(guild, song) {
    const serverQueue = queue.get(guild.id);
    if (!serverQueue || !serverQueue.audioPlayer) {
        console.error('Server queue or audio player not found');
        return;
    }

    //no songs then leave
    if (!song) {
      
        serverQueue.connection.destroy();

        //empty music folder
        fs.readdir(directory, (err, files) => {
            if (err) throw err;

            for (const file of files) {
                fs.unlink(path.join(directory, file), (err) => {
                    if (err) throw err;
                });
            }
        });
        queue.delete(guild.id);
        return;
    }

   

    try {

        //improve audio quality
        const ytdlOptions = {
            filter: 'audioonly',
            quality: 'highestaudio',
            format: 'bestaudio',
            noplaylist: true,
        };
      
        //download songs from link and play it
        const filePath = `./Music/${song.title}.mp4`;
        ytdl(song.url, ytdlOptions)
            .pipe(fs.createWriteStream(filePath))
            .on('finish', async () => {
                try {
                    const resource = createAudioResource(fs.createReadStream(filePath));
                    serverQueue.audioPlayer.play(resource);
                    serverQueue.textChannel.send(`🎵 Now playing: **${song.title}**`);
                } catch (error) {
                    console.error('Error playing local file:', error);
                    serverQueue.textChannel.send('An error occurred while trying to play the local file.');
                    playNext(guild, serverQueue);
                }
            });

            //playing next song if current song has finish playing
        serverQueue.audioPlayer.on('stateChange', (oldState, newState) => {
            console.log(`Player: ${oldState.status} → ${newState.status}`);
            if (newState.status === 'idle') {
                playNext(guild, serverQueue);
            }
        });

        serverQueue.connection.on('stateChange', (oldState, newState) => {
            console.log(`Connection: ${oldState.status} → ${newState.status}`);
        });

        console.log(`Now playing: ${song.title}`);

    } catch (error) {
        console.error(`Error playing ${song.title}:`, error);
        playNext(guild, serverQueue);
    }
}

function playNext(guild, serverQueue) {
    // Remove the first song from the queue
    serverQueue.songs.shift();

    if (serverQueue.songs.length > 0) {
        // Play the next song in the queue
        play(guild, serverQueue.songs[0]);
    } else {
        // Prevent duplicate messages
        if (!serverQueue.queueEnded) {
            serverQueue.queueEnded = true; // Set a flag to indicate the queue is empty
            serverQueue.textChannel.send('Queue is empty ;-;');
            
        }

        // Clean up the server queue
        queue.delete(guild.id);
    }
}










