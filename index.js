// index.js

import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import http from 'http';

dotenv.config();

// Express server to prevent sleeping
const app = express();
const port = 3000;
app.get('/', (req, res) => res.send('Bot is alive!'));
app.listen(port, () => console.log(`🚀 Express server running on port ${port}`));

// Discord client setup
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Secrets from Replit
const BOT_TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const SELF_PING_URL = process.env.SELF_PING_URL;

// Slash commands setup
const commands = [
  new SlashCommandBuilder()
    .setName('say')
    .setDescription('Say something as the bot')
    .addStringOption(option =>
      option.setName('message')
        .setDescription('Message for the bot to say')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('ask')
    .setDescription('Ask OpenAI anything')
    .addStringOption(option =>
      option.setName('prompt')
        .setDescription('Your question to OpenAI')
        .setRequired(true)
    )
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);

(async () => {
  try {
    console.log('📡 Registering slash commands...');
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('✅ Slash commands registered.');
  } catch (error) {
    console.error('❌ Failed to register commands:', error);
  }
})();

client.on('ready', () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
  checkLatestTweet();
  setInterval(checkLatestTweet, 60 * 1000); // every 1 minute
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'say') {
    const msg = interaction.options.getString('message');
    await interaction.deferReply({ ephemeral: true });
    await interaction.deleteReply();
    const channel = await client.channels.fetch(interaction.channelId);
    if (channel.isTextBased()) {
      channel.send(msg);
    }
  }

  if (interaction.commandName === 'ask') {
    const prompt = interaction.options.getString('prompt');
    await interaction.deferReply();
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }]
        })
      });
      const data = await response.json();
      const answer = data.choices?.[0]?.message?.content || 'Something went wrong.';
      await interaction.editReply(answer);
    } catch (err) {
      console.error('❌ OpenAI API Error:', err);
      await interaction.editReply('❌ Error communicating with OpenAI API.');
    }
  }
});

// Twitter Auto Fetch
let lastTweetId = null;
const WATCHER_GURU_ID = '1244160501793519616';

async function checkLatestTweet() {
  try {
    const res = await fetch(`https://api.twitter.com/2/users/${WATCHER_GURU_ID}/tweets?exclude=replies&max_results=5`, {
      headers: {
        Authorization: `Bearer ${TWITTER_BEARER_TOKEN}`
      }
    });
    const data = await res.json();

    if (data?.data?.length > 0) {
      const tweet = data.data[0];
      if (tweet.id !== lastTweetId) {
        lastTweetId = tweet.id;
        const tweetUrl = `https://twitter.com/WatcherGuru/status/${tweet.id}`;
        const channel = await client.channels.fetch(DISCORD_CHANNEL_ID);
        if (channel.isTextBased()) {
          channel.send(`🧠 ${tweet.text}\n🔗 ${tweetUrl}`);
        }
      }
    }
  } catch (err) {
    console.error('❌ Failed to fetch tweet:', err);
  }
}

// Self-ping to keep Replit alive
setInterval(() => {
  if (!SELF_PING_URL) return;
  fetch(SELF_PING_URL)
    .then(() => console.log('🔁 Self-ping sent'))
    .catch(err => console.error('⚠️ Self-ping failed:', err));
}, 280000); // every 4m 40s

client.login(BOT_TOKEN);
