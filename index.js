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

// Coin price history storage
const lastPrices = {};
const COINGECKO_SYMBOLS = [
  'bitcoin', 'ethereum', 'solana', 'pepe', 'sui', 'mog-coin', 'moodeng', 'brett', 'housecoin',
  'kaspa', 'space', 'bellscoin', 'clore', 'xec', 'octa', 'rvn', 'nexa', 'dnx', 'xna', 'dingo',
  'soh', 'bsv', 'sdr', 'satox', 'neox', 'ckb', 'blockx', 'etc', 'alph', 'ppc', 'cau', 'mewc',
  'dgb', 'fren', 'zeph', 'btcz', 'dvt', 'fch', 'pac', 'zec', 'aitpg', 'kls', 'nacho', 'kaspy',
  'kango', 'arrr', 'kasper', 'rxd', 'beam', 'fractal-bitcoin', 'pepe-coin', 'fartcoin', 'spx6900'
];

const ALERT_THRESHOLDS = {
  bitcoin: 10, ethereum: 10, solana: 10, pepe: 50,
  'sui': 20, 'mog-coin': 50, 'moodeng': 50, 'brett': 50, 'housecoin': 50,
  'kaspa': 50, 'space': 50, 'bellscoin': 50, 'clore': 50, 'xec': 50, 'octa': 50, 'rvn': 50,
  'nexa': 50, 'dnx': 50, 'xna': 50, 'dingo': 50, 'soh': 50, 'bsv': 50, 'sdr': 50, 'satox': 50,
  'neox': 50, 'ckb': 50, 'blockx': 50, 'etc': 50, 'alph': 50, 'ppc': 50, 'cau': 50, 'mewc': 50,
  'dgb': 50, 'fren': 50, 'zeph': 50, 'btcz': 50, 'dvt': 50, 'fch': 50, 'pac': 50, 'zec': 50,
  'aitpg': 50, 'kls': 50, 'nacho': 50, 'kaspy': 50, 'kango': 50, 'arrr': 50, 'kasper': 50,
  'rxd': 50, 'beam': 50, 'FB': 50, 'pep': 50, 'fartcoin': 50, 'spx6900': 50
};

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
  checkAllTwitterAccounts();
  setInterval(checkAllTwitterAccounts, 60 * 1000);
  setInterval(checkCryptoPrices, 120 * 1000);
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
let lastTweetIds = {};
const TWITTER_USER_IDS = {
  'WatcherGuru': '1244160501793519616',
  'DegenerateNews': '1397256779620175872',
  'realDonaldTrump': '25073877',
  'arkham': '1433001060820645895'
};

async function checkAllTwitterAccounts() {
  for (const [name, id] of Object.entries(TWITTER_USER_IDS)) {
    try {
      const res = await fetch(`https://api.twitter.com/2/users/${id}/tweets?exclude=replies&max_results=5`, {
        headers: {
          Authorization: `Bearer ${TWITTER_BEARER_TOKEN}`
        }
      });
      const data = await res.json();

      if (data?.data?.length > 0) {
        const tweet = data.data[0];
        if (tweet.id !== lastTweetIds[id]) {
          lastTweetIds[id] = tweet.id;
          const tweetUrl = `https://twitter.com/${name}/status/${tweet.id}`;
          const channel = await client.channels.fetch(DISCORD_CHANNEL_ID);
          if (channel.isTextBased()) {
            channel.send(`🧠 NEW POST from @${name}:
${tweet.text}
🔗 ${tweetUrl}`);
          }
        }
      }
    } catch (err) {
      console.error(`❌ Failed to fetch tweet from @${name}:`, err);
    }
  }
}

// CoinGecko price alerts with % change logic
async function checkCryptoPrices() {
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${COINGECKO_SYMBOLS.join(',')}&vs_currencies=usd`);
    const data = await res.json();
    const channel = await client.channels.fetch(DISCORD_CHANNEL_ID);

    if (!channel.isTextBased()) return;

    for (const symbol of COINGECKO_SYMBOLS) {
      const price = data[symbol]?.usd;
      if (!price) continue;

      const last = lastPrices[symbol];
      if (last) {
        const change = ((price - last) / last) * 100;
        const threshold = ALERT_THRESHOLDS[symbol];
        if (Math.abs(change) >= threshold) {
          const direction = change > 0 ? 'up' : 'down';
          channel.send(`📈 ${symbol.toUpperCase()} is ${direction} ${Math.abs(change).toFixed(2)}%: $${price.toFixed(2)}`);
        }
      }
      lastPrices[symbol] = price;
    }
  } catch (err) {
    console.error('❌ Failed to fetch crypto prices from CoinGecko:', err);
  }
}

// Self-ping to keep Replit alive
setInterval(() => {
  if (!SELF_PING_URL) return;
  fetch(SELF_PING_URL)
    .then(() => console.log('🔁 Self-ping sent'))
    .catch(err => console.error('⚠️ Self-ping failed:', err));
}, 280000);

client.login(BOT_TOKEN);
