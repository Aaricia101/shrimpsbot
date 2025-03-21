const { Client, GuildMember, GatewayIntentBits } = require('discord.js');
const { createAudioPlayer, createAudioResource, NoSubscriberBehavior, StreamType, entersState, VoiceConnectionStatus, getVoiceConnection, joinVoiceChannel } = require('@discordjs/voice');
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates]
});
require('dotenv').config();
//const ffmpeg = require('@ffmpeg-installer/ffmpeg');
const fluentFfmpeg = require('fluent-ffmpeg');
const ffmpeg = require('fluent-ffmpeg');
const ytdl = require("@distube/ytdl-core");
const { getInfo } = require('@distube/ytdl-core');
const Bottleneck = require('bottleneck');
const fs = require('fs');
const { readdir, unlink, createWriteStream, createReadStream } = require('fs');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const playdl = require('play-dl');
const { exec } = require('child_process');
ffmpeg.setFfmpegPath(ffmpegPath);
const prefix = "!"
var serverQueue = ""
const queue = new Map();
//limiter to avoid being flagged by youtube bot blocker
const limiter = new Bottleneck({
    maxConcurrent: 1,
    minTime: 2000
});

const { join } = require('path');
const { OpusEncoder } = require('@discordjs/opus');


const directory = "Music";


client.login(process.env.DISCORD_TOKEN);

client.on('ready', () => {
    console.log('Ready!');
    readdir(directory, (err, files) => {
        if (err) throw err;

        for (const file of files) {
            unlink(join(directory, file), (err) => {
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
    const songInfo = await getInfo(url);
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
    if (!message.member.voice.channel) {
        return message.channel.send("You have to be in a voice channel to skip the music!");
    }
    if (!serverQueue || serverQueue.songs.length === 0) {
        return message.channel.send("There are no songs left to skip!");
    }

    // Notify the user about the skipped song
    serverQueue.textChannel.send(`🎵 Now Skipping: **${serverQueue.songs[0].title}**`);

    // Remove the current song from the queue
    serverQueue.songs.shift();

    // Check if there are more songs in the queue
    if (serverQueue.songs.length > 0) {
        playNext(message.guild, serverQueue); // Play the next song
    } else {
        // If no songs are left, stop the audio player and disconnect
        serverQueue.audioPlayer.stop();
        serverQueue.connection.destroy();
        message.channel.send("No more songs in the queue. Leaving the voice channel.");
        queue.delete(message.guild.id); // Clean up the server's queue
    }
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

    if (!song) {
        serverQueue.connection.destroy();

        queue.delete(guild.id);
        return;
    }

    try {
        const ytdlOptions = {

            highWaterMark: 1 << 25,
            
            
        };

        //download songs from link and play it
        const filePath = `./Music/${song.title.replace(/[/\\?%*:|"<>]/g, '-')}.flac`;

        ytdl(song.url, ytdlOptions)
            .pipe(fs.createWriteStream(`${filePath}.webm`))
            .on('finish', () => {
                // Convert WebM to Opus using FFmpeg
                exec(`ffmpeg -i "${filePath}.webm" -c:a libopus -vbr on -compression_level 10 -b:a 256k -ar 48000 -af "aresample=resampler=soxr" "${filePath}.opus"`, (error) => {
                    if (error) {
                        console.error('Error converting file:', error);
                        return;
                    }

                    try {
                        const resource = createAudioResource(`${filePath}.opus`, {
                            inputType: StreamType.WebmOpus,
                            inlineVolume: true,
                            
                        });

                        resource.volume.setVolumeLogarithmic(1); 
                        serverQueue.audioPlayer.play(resource);
                        serverQueue.textChannel.send(`🎵 Now playing: **${song.title}**`);

                        // Clean up temporary files
                        fs.unlink(`${filePath}.webm`, (err) => {
                            if (err) console.error('Error deleting WebM file:', err);
                        });
                    } catch (error) {
                        console.error('Error playing processed file:', error);
                        serverQueue.textChannel.send('An error occurred while trying to play the processed file.');
                        playNext(guild, serverQueue);
                    }
                });
            })
            .on('error', (err) => {
                console.error('Error downloading video:', err);
                serverQueue.textChannel.send('An error occurred while downloading the video.');
                playNext(guild, serverQueue);
            });


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
        handleStreamingError(error, serverQueue, guild);
    }
}


function handleStreamingError(error, serverQueue, guild) {
    console.error('Streaming Error:', error);
    console.error('Error stack:', error.stack);

}

function playNext(guild, serverQueue) {
    if (!serverQueue.songs.length) {
        // If no more songs are in the queue, disconnect and clean up
        serverQueue.connection.destroy();
        queue.delete(guild.id);
        serverQueue.textChannel.send("No more songs in the queue. Leaving the voice channel.");
        return;
    }

    const nextSong = serverQueue.songs[0];

    try {
        const stream = ytdl(nextSong.url, { filter: 'audioonly', quality: 'highestaudio' });
        const resource = createAudioResource(stream);

        serverQueue.audioPlayer.play(resource);

        serverQueue.textChannel.send(`🎵 Now Playing: **${nextSong.title}**`);
    } catch (error) {
        console.error(`Error playing next song: ${error}`);
        serverQueue.songs.shift(); // Remove the problematic song and try the next one
        playNext(guild, serverQueue);
    }
}









