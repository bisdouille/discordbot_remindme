import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ContextMenuCommandBuilder, ApplicationCommandType, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import * as chrono from 'chrono-node';
import axios from 'axios';
import express from 'express';

// Configuration
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Créer le client Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
  ],
});

// Fichiers de stockage
const REMINDERS_FILE = join(__dirname, 'reminders.json');
const WEBHOOK_IDS_FILE = join(__dirname, 'trello-webhooks.json');
const TAGGED_CONVERSATIONS_FILE = join(__dirname, 'tagged-conversations.json');
const AVAILABLE_TAGS_FILE = join(__dirname, 'available-tags.json');

// Cache pour éviter les notifications en double (cardId -> timestamp)
const notificationCache = new Map();

// Cache temporaire pour stocker les URLs des messages (messageId -> url)
// Expire après 10 minutes
const messageUrlCache = new Map();

// Charger les rappels depuis le fichier
async function loadReminders() {
  try {
    const data = await fs.readFile(REMINDERS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

// Sauvegarder les rappels dans le fichier
async function saveReminders(reminders) {
  await fs.writeFile(REMINDERS_FILE, JSON.stringify(reminders, null, 2));
}

// Charger les IDs de webhooks
async function loadWebhookIds() {
  try {
    const data = await fs.readFile(WEBHOOK_IDS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

// Sauvegarder les IDs de webhooks
async function saveWebhookIds(webhookIds) {
  await fs.writeFile(WEBHOOK_IDS_FILE, JSON.stringify(webhookIds, null, 2));
}

// ==================== FONCTIONS GESTION TAGS CONVERSATIONS ====================

// Initialiser les fichiers JSON s'ils n'existent pas
async function initializeTagsFiles() {
  try {
    // Vérifier si tagged-conversations.json existe
    try {
      await fs.access(TAGGED_CONVERSATIONS_FILE);
    } catch {
      // Créer le fichier s'il n'existe pas
      await fs.writeFile(TAGGED_CONVERSATIONS_FILE, JSON.stringify([], null, 2));
      console.log('✅ Fichier tagged-conversations.json créé');
    }

    // Vérifier si available-tags.json existe
    try {
      await fs.access(AVAILABLE_TAGS_FILE);
    } catch {
      // Créer le fichier avec des tags par défaut
      const defaultTags = {
        tags: ["Influenceur", "FR", "EN", "Prestataire MC", "Client", "Partenaire"],
        categories: ["Clients", "Partenaires", "Prospects", "Équipe"]
      };
      await fs.writeFile(AVAILABLE_TAGS_FILE, JSON.stringify(defaultTags, null, 2));
      console.log('✅ Fichier available-tags.json créé avec tags par défaut');
    }
  } catch (error) {
    console.error('Erreur lors de l\'initialisation des fichiers tags:', error);
  }
}

// Charger les conversations taguées
async function loadTaggedConversations() {
  try {
    const data = await fs.readFile(TAGGED_CONVERSATIONS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Erreur chargement conversations:', error);
    return [];
  }
}

// Sauvegarder les conversations taguées
async function saveTaggedConversations(conversations) {
  try {
    await fs.writeFile(TAGGED_CONVERSATIONS_FILE, JSON.stringify(conversations, null, 2));
  } catch (error) {
    console.error('Erreur sauvegarde conversations:', error);
    throw error;
  }
}

// Charger les tags disponibles
async function loadAvailableTags() {
  try {
    const data = await fs.readFile(AVAILABLE_TAGS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Erreur chargement tags:', error);
    return { tags: [], categories: [] };
  }
}

// Sauvegarder les tags disponibles
async function saveAvailableTags(tagsData) {
  try {
    await fs.writeFile(AVAILABLE_TAGS_FILE, JSON.stringify(tagsData, null, 2));
  } catch (error) {
    console.error('Erreur sauvegarde tags:', error);
    throw error;
  }
}

// Trouver une conversation existante
function findConversation(conversations, conversationId, ownerId) {
  return conversations.find(c => c.conversationId === conversationId && c.ownerId === ownerId);
}

// Créer ou mettre à jour une conversation taguée
async function createOrUpdateTaggedConversation(conversationData) {
  const conversations = await loadTaggedConversations();
  const existing = findConversation(conversations, conversationData.conversationId, conversationData.ownerId);

  if (existing) {
    // Mise à jour
    existing.nom = conversationData.nom;
    existing.tags = conversationData.tags;
    existing.categorie = conversationData.categorie;
    existing.messageLink = conversationData.messageLink;
    existing.updatedAt = Date.now();
    await saveTaggedConversations(conversations);
    return { isNew: false, conversation: existing };
  } else {
    // Création
    const newConversation = {
      ...conversationData,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    conversations.push(newConversation);
    await saveTaggedConversations(conversations);
    return { isNew: true, conversation: newConversation };
  }
}

// ==================== FONCTIONS TRELLO ====================

async function trelloRequest(endpoint, method = 'GET', data = null) {
  const apiKey = process.env.TRELLO_API_KEY;
  const token = process.env.TRELLO_TOKEN;

  if (!apiKey || !token) {
    throw new Error('Configuration Trello manquante. Ajoutez TRELLO_API_KEY et TRELLO_TOKEN dans .env');
  }

  const url = `https://api.trello.com/1${endpoint}`;
  const config = {
    method,
    url,
    params: { key: apiKey, token },
  };

  if (data && method !== 'GET') {
    if (method === 'GET') {
      config.params = { ...config.params, ...data };
    } else {
      config.data = data;
    }
  }

  const response = await axios(config);
  return response.data;
}

async function getTrelloLists(boardId) {
  return await trelloRequest(`/boards/${boardId}/lists`);
}

async function getTrelloCards(listId) {
  return await trelloRequest(`/lists/${listId}/cards`);
}

async function moveTrelloCard(cardId, listId) {
  return await trelloRequest(`/cards/${cardId}`, 'PUT', { idList: listId });
}

async function createTrelloCard(listId, name, desc = '') {
  return await trelloRequest('/cards', 'POST', { idList: listId, name, desc });
}

async function createTrelloWebhook(callbackURL, idModel, description = 'Discord Reminder Bot') {
  return await trelloRequest('/webhooks', 'POST', {
    callbackURL,
    idModel,
    description
  });
}

async function deleteTrelloWebhook(webhookId) {
  return await trelloRequest(`/webhooks/${webhookId}`, 'DELETE');
}

async function listTrelloWebhooks() {
  const token = process.env.TRELLO_TOKEN;
  return await trelloRequest(`/tokens/${token}/webhooks`);
}

// ==================== FONCTIONS DE RAPPEL ====================

// Créer ou mettre à jour 2 rappels (10h et 15h) pour une carte Trello
async function createOrUpdateRemindersForTrelloCard(card, userId) {
  const reminders = await loadReminders();
  const now = new Date();

  // Construire l'URL de la carte manuellement
  const cardUrl = card.url || (card.shortLink ? `https://trello.com/c/${card.shortLink}` : `https://trello.com/c/${card.id}`);

  // Vérifier si des rappels existent déjà pour cette carte
  const existingReminders = reminders.filter(r => r.trelloCardId === card.id);

  // Calculer 10h aujourd'hui/demain
  const reminder10h = new Date();
  reminder10h.setHours(10, 0, 0, 0);
  if (reminder10h <= now) {
    reminder10h.setDate(reminder10h.getDate() + 1);
  }

  // Calculer 15h aujourd'hui/demain
  const reminder15h = new Date();
  reminder15h.setHours(15, 0, 0, 0);
  if (reminder15h <= now) {
    reminder15h.setDate(reminder15h.getDate() + 1);
  }

  if (existingReminders.length > 0) {
    // Mettre à jour les rappels existants
    existingReminders.forEach(reminder => {
      reminder.message = card.name;
      reminder.lien = cardUrl;
    });
    await saveReminders(reminders);
    console.log(`🔄 Rappels mis à jour pour carte Trello: ${card.name}`);
    return existingReminders;
  } else {
    // Créer de nouveaux rappels
    const reminder1 = {
      id: Date.now(),
      userId,
      message: card.name,
      timestamp: reminder10h.getTime(),
      createdAt: Date.now(),
      contexte: 'Tâche Trello - Rappel du matin',
      lien: cardUrl,
      tag: 'Trello',
      priorite: 'moyenne',
      trelloCardId: card.id
    };

    const reminder2 = {
      id: Date.now() + 1,
      userId,
      message: card.name,
      timestamp: reminder15h.getTime(),
      createdAt: Date.now(),
      contexte: 'Tâche Trello - Rappel de l\'après-midi',
      lien: cardUrl,
      tag: 'Trello',
      priorite: 'moyenne',
      trelloCardId: card.id
    };

    reminders.push(reminder1, reminder2);
    await saveReminders(reminders);

    console.log(`✅ 2 rappels créés pour carte Trello: ${card.name} (10h et 15h)`);
    return [reminder1, reminder2];
  }
}

// Vérifier si une notification a déjà été envoyée récemment (5 minutes)
function shouldNotify(cardId) {
  const now = Date.now();
  const lastNotification = notificationCache.get(cardId);

  if (!lastNotification) {
    // Première notification
    notificationCache.set(cardId, now);
    return true;
  }

  // Vérifier si 5 minutes se sont écoulées
  const fiveMinutes = 5 * 60 * 1000;
  if (now - lastNotification > fiveMinutes) {
    notificationCache.set(cardId, now);
    return true;
  }

  return false;
}

// Supprimer tous les rappels liés à une carte Trello
async function deleteRemindersForTrelloCard(cardId) {
  const reminders = await loadReminders();
  const filtered = reminders.filter(r => r.trelloCardId !== cardId);
  const deleted = reminders.length - filtered.length;
  await saveReminders(filtered);

  if (deleted > 0) {
    console.log(`🗑️ ${deleted} rappel(s) supprimé(s) pour la carte Trello ${cardId}`);
  }

  return deleted;
}

// ==================== SERVEUR WEBHOOK ====================

const app = express();
app.use(express.json());

// Route de santé pour garder Render éveillé
app.get('/', (req, res) => {
  res.status(200).send('Bot Discord actif ✅');
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    bot: client.user ? client.user.tag : 'non connecté',
    uptime: process.uptime()
  });
});

// Route HEAD pour la validation du webhook Trello
app.head('/webhook/trello', (req, res) => {
  res.status(200).send();
});

// Route POST pour recevoir les événements Trello
app.post('/webhook/trello', async (req, res) => {
  try {
    const { action } = req.body;

    if (!action) {
      return res.status(200).send('OK');
    }

    console.log(`📬 Webhook Trello reçu: ${action.type}`);

    // Carte créée
    if (action.type === 'createCard') {
      const card = action.data.card;
      const list = action.data.list;

      // Récupérer l'ID utilisateur Discord
      const userId = process.env.TRELLO_USER_ID;
      if (!userId) {
        console.log('⚠️ TRELLO_USER_ID non configuré');
        return res.status(200).send('OK');
      }

      // Carte créée dans "To Do"
      if (list && (list.name.toLowerCase().includes('to do') || list.name.toLowerCase().includes('à faire'))) {
        await createOrUpdateRemindersForTrelloCard(card, userId);

        // Première notification (carte créée)
        if (shouldNotify(card.id)) {
          try {
            const user = await client.users.fetch(userId);
            // Construire l'URL de la carte manuellement
            const cardUrl = card.url || (card.shortLink ? `https://trello.com/c/${card.shortLink}` : `https://trello.com/c/${card.id}`);
            await user.send(`🆕 **Nouvelle tâche Trello ajoutée**\n\n📋 ${card.name}\n\n⏰ Vous recevrez 2 rappels : à 10h et 15h\n🔗 ${cardUrl}`);
          } catch (error) {
            console.error('Erreur envoi notification:', error);
          }
        }
      }
    }

    // Carte mise à jour
    if (action.type === 'updateCard') {
      const card = action.data.card;
      const list = action.data.list;
      const listAfter = action.data.listAfter;
      const old = action.data.old;

      // Récupérer l'ID utilisateur Discord
      const userId = process.env.TRELLO_USER_ID;
      if (!userId) {
        console.log('⚠️ TRELLO_USER_ID non configuré');
        return res.status(200).send('OK');
      }

      // Carte déplacée vers "To Do" (depuis une autre liste)
      if (listAfter && (listAfter.name.toLowerCase().includes('to do') || listAfter.name.toLowerCase().includes('à faire'))) {
        await createOrUpdateRemindersForTrelloCard(card, userId);

        // Notifier seulement si pas notifié récemment
        if (shouldNotify(card.id)) {
          try {
            const user = await client.users.fetch(userId);
            // Construire l'URL de la carte manuellement
            const cardUrl = card.url || (card.shortLink ? `https://trello.com/c/${card.shortLink}` : `https://trello.com/c/${card.id}`);
            await user.send(`🆕 **Nouvelle tâche Trello ajoutée**\n\n📋 ${card.name}\n\n⏰ Vous recevrez 2 rappels : à 10h et 15h\n🔗 ${cardUrl}`);
          } catch (error) {
            console.error('Erreur envoi notification:', error);
          }
        }
      }
      // Carte modifiée dans "To Do" (nom, description, etc.)
      else if (list && (list.name.toLowerCase().includes('to do') || list.name.toLowerCase().includes('à faire'))) {
        // Mettre à jour les rappels en silence
        await createOrUpdateRemindersForTrelloCard(card, userId);
        console.log(`🔄 Carte mise à jour silencieusement: ${card.name}`);
      }

      // Carte déplacée vers "Done" ou "Fait"
      if (listAfter && (listAfter.name.toLowerCase().includes('done') || listAfter.name.toLowerCase().includes('fait'))) {
        const deleted = await deleteRemindersForTrelloCard(card.id);

        if (deleted > 0) {
          try {
            const user = await client.users.fetch(userId);
            await user.send(`✅ **Tâche Trello terminée**\n\n📋 ${card.name}\n\n${deleted} rappel(s) supprimé(s)`);
          } catch (error) {
            console.error('Erreur envoi notification:', error);
          }
        }
      }
    }

    // Carte supprimée
    if (action.type === 'deleteCard') {
      const card = action.data.card;
      await deleteRemindersForTrelloCard(card.id);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Erreur webhook:', error);
    res.status(200).send('OK'); // Toujours renvoyer 200 pour ne pas désactiver le webhook
  }
});

// Démarrer le serveur webhook
// Render fournit PORT, Railway fournit WEBHOOK_PORT
const WEBHOOK_PORT = process.env.PORT || process.env.WEBHOOK_PORT || 3000;
app.listen(WEBHOOK_PORT, '0.0.0.0', () => {
  console.log(`🌐 Serveur webhook démarré sur le port ${WEBHOOK_PORT}`);
});

// ==================== DÉFINITION DES COMMANDES ====================

const commands = [
  // Commande /rappel classique avec tags et priorités
  new SlashCommandBuilder()
    .setName('rappel')
    .setDescription('Créer un rappel détaillé')
    .addStringOption(option =>
      option
        .setName('message')
        .setDescription('Le message du rappel')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('jours')
        .setDescription('Nombre de jours avant le rappel')
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option
        .setName('heures')
        .setDescription('Nombre d\'heures avant le rappel')
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option
        .setName('minutes')
        .setDescription('Nombre de minutes avant le rappel')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('contexte')
        .setDescription('Contexte du rappel (ex: "Message de mon boss")')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('lien')
        .setDescription('Lien vers le message Discord')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('tag')
        .setDescription('Tag/catégorie (ex: "Client A", "Compta", "Urgent")')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('priorite')
        .setDescription('Niveau de priorité')
        .setRequired(false)
        .addChoices(
          { name: '🔴 Haute', value: 'haute' },
          { name: '🟡 Moyenne', value: 'moyenne' },
          { name: '🟢 Basse', value: 'basse' }
        )
    ),

  // Nouvelle commande /rappel-rapide avec parsing de dates naturelles
  new SlashCommandBuilder()
    .setName('rappel-rapide')
    .setDescription('Créer un rappel rapidement avec langage naturel')
    .addStringOption(option =>
      option
        .setName('quand')
        .setDescription('Quand? (ex: "demain 14h", "dans 2h", "lundi", "vendredi 9h")')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('message')
        .setDescription('Le message du rappel')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('tag')
        .setDescription('Tag/catégorie')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('priorite')
        .setDescription('Niveau de priorité')
        .setRequired(false)
        .addChoices(
          { name: '🔴 Haute', value: 'haute' },
          { name: '🟡 Moyenne', value: 'moyenne' },
          { name: '🟢 Basse', value: 'basse' }
        )
    ),

  new SlashCommandBuilder()
    .setName('mes-rappels')
    .setDescription('Voir tous vos rappels actifs'),

  new SlashCommandBuilder()
    .setName('rappels-par-tag')
    .setDescription('Voir vos rappels filtrés par tag')
    .addStringOption(option =>
      option
        .setName('tag')
        .setDescription('Le tag à filtrer')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('supprimer-rappel')
    .setDescription('Supprimer un rappel')
    .addIntegerOption(option =>
      option
        .setName('id')
        .setDescription('L\'ID du rappel à supprimer')
        .setRequired(true)
    ),

  // Commandes Trello
  new SlashCommandBuilder()
    .setName('trello-import')
    .setDescription('Importer les tâches "To Do" depuis Trello')
    .addStringOption(option =>
      option
        .setName('liste')
        .setDescription('Nom de la liste à importer (ex: "To Do", "À faire")')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('quand')
        .setDescription('Quand créer les rappels? (ex: "demain 9h", "dans 1h")')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('trello-config')
    .setDescription('Voir ou tester la configuration Trello'),

  new SlashCommandBuilder()
    .setName('trello-webhook-setup')
    .setDescription('Configurer les webhooks automatiques Trello'),

  new SlashCommandBuilder()
    .setName('trello-webhook-delete')
    .setDescription('Supprimer tous les webhooks Trello'),

  new SlashCommandBuilder()
    .setName('clear-tout')
    .setDescription('⚠️ Supprimer TOUS vos rappels (action irréversible)'),

  // ==================== COMMANDES GESTION TAGS CONVERSATIONS ====================

  new SlashCommandBuilder()
    .setName('tags-creer')
    .setDescription('Créer un nouveau tag')
    .addStringOption(option =>
      option
        .setName('nom')
        .setDescription('Nom du tag (ex: "Influenceur", "FR", "Prestataire MC")')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('tags-liste')
    .setDescription('Voir tous les tags et catégories disponibles'),

  new SlashCommandBuilder()
    .setName('tags-supprimer')
    .setDescription('Supprimer un tag existant')
    .addStringOption(option =>
      option
        .setName('nom')
        .setDescription('Nom du tag à supprimer')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('categorie-creer')
    .setDescription('Créer une nouvelle catégorie')
    .addStringOption(option =>
      option
        .setName('nom')
        .setDescription('Nom de la catégorie (ex: "Clients", "Partenaires")')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('categorie-supprimer')
    .setDescription('Supprimer une catégorie existante')
    .addStringOption(option =>
      option
        .setName('nom')
        .setDescription('Nom de la catégorie à supprimer')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('conversations-taguees')
    .setDescription('Voir toutes vos conversations taguées')
    .addStringOption(option =>
      option
        .setName('categorie')
        .setDescription('Filtrer par catégorie (optionnel)')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('conversations-par-tag')
    .setDescription('Voir les conversations filtrées par tag')
    .addStringOption(option =>
      option
        .setName('tag')
        .setDescription('Le tag à filtrer')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('conversation-modifier')
    .setDescription('Modifier les tags d\'une conversation')
    .addStringOption(option =>
      option
        .setName('nom')
        .setDescription('Nom de la conversation à modifier')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('conversation-supprimer')
    .setDescription('Retirer complètement une conversation des tags')
    .addStringOption(option =>
      option
        .setName('nom')
        .setDescription('Nom de la conversation à supprimer')
        .setRequired(true)
    ),

  // Commandes de menu contextuel (clic droit sur message)
  new ContextMenuCommandBuilder()
    .setName('Créer un rappel')
    .setType(ApplicationCommandType.Message),

  new ContextMenuCommandBuilder()
    .setName('Taguer cette conversation')
    .setType(ApplicationCommandType.Message),
].map(command => {
  const json = command.toJSON();
  // Permettre les commandes dans les DMs et serveurs
  json.integration_types = [0, 1]; // 0 = GUILD_INSTALL, 1 = USER_INSTALL
  json.contexts = [0, 1, 2]; // 0 = GUILD, 1 = BOT_DM, 2 = PRIVATE_CHANNEL
  return json;
});

// Enregistrer les commandes slash
async function registerCommands() {
  try {
    console.log('Enregistrement des commandes slash...');
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );

    console.log('Commandes slash enregistrées avec succès !');
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement des commandes:', error);
  }
}

// ==================== GESTIONNAIRE D'INTERACTIONS ====================

client.on('interactionCreate', async interaction => {
  try {
    // Gérer les commandes de menu contextuel (clic droit)
    if (interaction.isMessageContextMenuCommand()) {
      if (interaction.commandName === 'Créer un rappel') {
        const message = interaction.targetMessage;

        // Stocker l'URL du message dans le cache temporaire
        const messageUrl = message.url || `https://discord.com/channels/${message.guildId || '@me'}/${message.channelId}/${message.id}`;
        messageUrlCache.set(message.id, messageUrl);
        // Auto-nettoyer après 10 minutes
        setTimeout(() => messageUrlCache.delete(message.id), 10 * 60 * 1000);

        // Créer un modal pour demander les détails du rappel
        const modal = new ModalBuilder()
          .setCustomId(`reminder_modal_${message.id}`)
          .setTitle('Créer un rappel depuis ce message');

        const quandInput = new TextInputBuilder()
          .setCustomId('quand')
          .setLabel('Quand ?')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ex: demain 14h, dans 2h, lundi 9h')
          .setRequired(true);

        const noteInput = new TextInputBuilder()
          .setCustomId('note')
          .setLabel('Tâche')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Contexte ou note pour ce rappel...')
          .setRequired(false);

        const row1 = new ActionRowBuilder().addComponents(quandInput);
        const row2 = new ActionRowBuilder().addComponents(noteInput);

        modal.addComponents(row1, row2);

        await interaction.showModal(modal);
        return;
      }

      // Menu contextuel: Taguer cette conversation
      if (interaction.commandName === 'Taguer cette conversation') {
        const message = interaction.targetMessage;

        // Déterminer l'ID de la conversation
        const conversationId = message.channelId;

        // Vérifier si une conversation existe déjà
        const conversations = await loadTaggedConversations();
        const existing = findConversation(conversations, conversationId, interaction.user.id);

        // Charger les tags et catégories disponibles
        const tagsData = await loadAvailableTags();

        // Créer un modal pour demander les détails
        const modal = new ModalBuilder()
          .setCustomId(`tag_conversation_modal_${conversationId}`)
          .setTitle(existing ? 'Modifier les tags' : 'Taguer cette conversation');

        const nomInput = new TextInputBuilder()
          .setCustomId('nom')
          .setLabel('Nom de la personne/conversation')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ex: Jean, Marie, Partenaire X...')
          .setRequired(true);

        if (existing) {
          nomInput.setValue(existing.nom);
        }

        const tagsInput = new TextInputBuilder()
          .setCustomId('tags')
          .setLabel('Tags (séparés par des virgules)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ex: Influenceur, FR, Prestataire MC')
          .setRequired(true);

        if (existing) {
          tagsInput.setValue(existing.tags.join(', '));
        } else if (tagsData.tags.length > 0) {
          tagsInput.setPlaceholder(`Disponibles: ${tagsData.tags.slice(0, 5).join(', ')}...`);
        }

        const categorieInput = new TextInputBuilder()
          .setCustomId('categorie')
          .setLabel('Catégorie (optionnel)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ex: Clients, Partenaires, Prospects...')
          .setRequired(false);

        if (existing) {
          categorieInput.setValue(existing.categorie || '');
        } else if (tagsData.categories.length > 0) {
          categorieInput.setPlaceholder(`Disponibles: ${tagsData.categories.slice(0, 3).join(', ')}...`);
        }

        const row1 = new ActionRowBuilder().addComponents(nomInput);
        const row2 = new ActionRowBuilder().addComponents(tagsInput);
        const row3 = new ActionRowBuilder().addComponents(categorieInput);

        modal.addComponents(row1, row2, row3);

        await interaction.showModal(modal);
        return;
      }
    }

  // Gérer les commandes slash
  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction;

    // COMMANDE: /rappel
    if (commandName === 'rappel') {
      await interaction.deferReply({ flags: 64 }); // 64 = ephemeral

      const message = interaction.options.getString('message');
      const jours = interaction.options.getInteger('jours') || 0;
      const heures = interaction.options.getInteger('heures') || 0;
      const minutes = interaction.options.getInteger('minutes') || 0;
      const contexte = interaction.options.getString('contexte');
      const lien = interaction.options.getString('lien');
      const tag = interaction.options.getString('tag');
      const priorite = interaction.options.getString('priorite') || 'moyenne';

      if (jours === 0 && heures === 0 && minutes === 0) {
        await interaction.editReply({
          content: '❌ Veuillez spécifier au moins une durée (jours, heures ou minutes).'
        });
        return;
      }

      const delaiMs = (jours * 24 * 60 * 60 * 1000) + (heures * 60 * 60 * 1000) + (minutes * 60 * 1000);
      const rappelTimestamp = Date.now() + delaiMs;

      const reminders = await loadReminders();
      const newReminder = {
        id: Date.now(),
        userId: interaction.user.id,
        message,
        timestamp: rappelTimestamp,
        createdAt: Date.now(),
        contexte: contexte || null,
        lien: lien || null,
        tag: tag || null,
        priorite,
        trelloCardId: null
      };

      reminders.push(newReminder);
      await saveReminders(reminders);

      const dureeTexte = [];
      if (jours > 0) dureeTexte.push(`${jours} jour${jours > 1 ? 's' : ''}`);
      if (heures > 0) dureeTexte.push(`${heures} heure${heures > 1 ? 's' : ''}`);
      if (minutes > 0) dureeTexte.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);

      const prioriteEmoji = { haute: '🔴', moyenne: '🟡', basse: '🟢' }[priorite];
      let confirmationMsg = `✅ Rappel créé ! Je vous rappellerai dans ${dureeTexte.join(', ')} :\n\n📋 **Tâche :** ${message}`;
      if (tag) confirmationMsg += `\n🏷️ **Tag :** ${tag}`;
      confirmationMsg += `\n${prioriteEmoji} **Priorité :** ${priorite}`;
      if (contexte) confirmationMsg += `\n👤 **Contexte :** ${contexte}`;
      if (lien) confirmationMsg += `\n🔗 **Lien :** ${lien}`;
      confirmationMsg += `\n\n📝 ID du rappel: ${newReminder.id}`;

      await interaction.editReply({ content: confirmationMsg });
    }

    // COMMANDE: /rappel-rapide
    if (commandName === 'rappel-rapide') {
      await interaction.deferReply({ flags: 64 }); // 64 = ephemeral

      const quand = interaction.options.getString('quand');
      const message = interaction.options.getString('message');
      const tag = interaction.options.getString('tag');
      const priorite = interaction.options.getString('priorite') || 'moyenne';

      // Parser la date avec chrono
      const parsedDate = chrono.fr.parseDate(quand, new Date());

      if (!parsedDate || parsedDate <= new Date()) {
        await interaction.editReply({
          content: `❌ Je n'ai pas pu comprendre "${quand}". Essayez: "demain 14h", "dans 2 heures", "lundi", "vendredi 9h"`
        });
        return;
      }

      const reminders = await loadReminders();
      const newReminder = {
        id: Date.now(),
        userId: interaction.user.id,
        message,
        timestamp: parsedDate.getTime(),
        createdAt: Date.now(),
        contexte: null,
        lien: null,
        tag: tag || null,
        priorite,
        trelloCardId: null
      };

      reminders.push(newReminder);
      await saveReminders(reminders);

      const dateStr = parsedDate.toLocaleString('fr-FR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit'
      });

      const prioriteEmoji = { haute: '🔴', moyenne: '🟡', basse: '🟢' }[priorite];
      let confirmationMsg = `✅ Rappel créé pour **${dateStr}** :\n\n📋 **Tâche :** ${message}`;
      if (tag) confirmationMsg += `\n🏷️ **Tag :** ${tag}`;
      confirmationMsg += `\n${prioriteEmoji} **Priorité :** ${priorite}`;
      confirmationMsg += `\n\n📝 ID du rappel: ${newReminder.id}`;

      await interaction.editReply({ content: confirmationMsg });
    }

    // COMMANDE: /mes-rappels
    if (commandName === 'mes-rappels') {
      await interaction.deferReply({ flags: 64 }); // 64 = ephemeral

      const reminders = await loadReminders();
      const userReminders = reminders.filter(r => r.userId === interaction.user.id);

      if (userReminders.length === 0) {
        await interaction.editReply({
          content: '📭 Vous n\'avez aucun rappel actif.'
        });
        return;
      }

      // Trier par priorité puis par date
      const priorityOrder = { haute: 0, moyenne: 1, basse: 2 };
      userReminders.sort((a, b) => {
        const priorityDiff = priorityOrder[a.priorite] - priorityOrder[b.priorite];
        if (priorityDiff !== 0) return priorityDiff;
        return a.timestamp - b.timestamp;
      });

      const rappelsList = userReminders.map(r => {
        const date = new Date(r.timestamp);
        const dateStr = date.toLocaleString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        const prioriteEmoji = { haute: '🔴', moyenne: '🟡', basse: '🟢' }[r.priorite];
        let rappelText = `${prioriteEmoji} **ID ${r.id}**: ${r.message}\n   ⏰ ${dateStr}`;
        if (r.tag) rappelText += `\n   🏷️ ${r.tag}`;
        if (r.contexte) rappelText += `\n   👤 ${r.contexte}`;
        if (r.lien) rappelText += `\n   🔗 ${r.lien}`;
        return rappelText;
      }).join('\n\n');

      // Créer un menu déroulant pour supprimer des rappels (max 25 options)
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('delete_reminders')
        .setPlaceholder('Sélectionnez des rappels à supprimer')
        .setMinValues(1)
        .setMaxValues(Math.min(userReminders.length, 25));

      // Ajouter les options (limité à 25 premiers rappels)
      userReminders.slice(0, 25).forEach(r => {
        const date = new Date(r.timestamp);
        const dateStr = date.toLocaleString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
        const prioriteEmoji = { haute: '🔴', moyenne: '🟡', basse: '🟢' }[r.priorite];

        selectMenu.addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel(`${r.message.substring(0, 80)}`)
            .setDescription(`${prioriteEmoji} ${dateStr}${r.tag ? ` • ${r.tag}` : ''}`)
            .setValue(r.id.toString())
        );
      });

      const row = new ActionRowBuilder().addComponents(selectMenu);

      await interaction.editReply({
        content: `📋 **Vos rappels actifs (${userReminders.length}):**\n\n${rappelsList}`,
        components: [row]
      });
    }

    // COMMANDE: /rappels-par-tag
    if (commandName === 'rappels-par-tag') {
      await interaction.deferReply({ flags: 64 }); // 64 = ephemeral

      const tag = interaction.options.getString('tag');
      const reminders = await loadReminders();
      const taggedReminders = reminders.filter(r => r.userId === interaction.user.id && r.tag === tag);

      if (taggedReminders.length === 0) {
        await interaction.editReply({
          content: `📭 Vous n'avez aucun rappel avec le tag "${tag}".`
        });
        return;
      }

      const rappelsList = taggedReminders.map(r => {
        const date = new Date(r.timestamp);
        const dateStr = date.toLocaleString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
        const prioriteEmoji = { haute: '🔴', moyenne: '🟡', basse: '🟢' }[r.priorite];
        return `${prioriteEmoji} **ID ${r.id}**: ${r.message}\n   ⏰ ${dateStr}`;
      }).join('\n\n');

      await interaction.editReply({
        content: `🏷️ **Rappels avec le tag "${tag}" (${taggedReminders.length}):**\n\n${rappelsList}`
      });
    }

    // COMMANDE: /supprimer-rappel
    if (commandName === 'supprimer-rappel') {
      await interaction.deferReply({ flags: 64 }); // 64 = ephemeral

      const id = interaction.options.getInteger('id');
      const reminders = await loadReminders();
      const index = reminders.findIndex(r => r.id === id && r.userId === interaction.user.id);

      if (index === -1) {
        await interaction.editReply({
          content: '❌ Rappel introuvable ou vous n\'avez pas la permission de le supprimer.'
        });
        return;
      }

      reminders.splice(index, 1);
      await saveReminders(reminders);

      await interaction.editReply({
        content: `🗑️ Rappel ${id} supprimé avec succès.`
      });
    }

    // COMMANDE: /trello-import
    if (commandName === 'trello-import') {
      const listeName = interaction.options.getString('liste');
      const quand = interaction.options.getString('quand');

      try {
        await interaction.deferReply({ flags: 64 }); // 64 = ephemeral

        const boardId = process.env.TRELLO_BOARD_ID;
        if (!boardId) {
          await interaction.editReply({
            content: '❌ TRELLO_BOARD_ID manquant dans .env'
          });
          return;
        }

        const lists = await getTrelloLists(boardId);
        const targetList = lists.find(l => l.name.toLowerCase() === listeName.toLowerCase());

        if (!targetList) {
          await interaction.editReply({
            content: `❌ Liste "${listeName}" introuvable. Listes disponibles: ${lists.map(l => l.name).join(', ')}`
          });
          return;
        }

        const cards = await getTrelloCards(targetList.id);

        if (cards.length === 0) {
          await interaction.editReply({
            content: `📭 Aucune carte dans la liste "${listeName}".`
          });
          return;
        }

        const parsedDate = chrono.fr.parseDate(quand, new Date());
        if (!parsedDate || parsedDate <= new Date()) {
          await interaction.editReply({
            content: `❌ Date invalide: "${quand}"`
          });
          return;
        }

        const reminders = await loadReminders();
        let imported = 0;

        for (const card of cards) {
          const newReminder = {
            id: Date.now() + imported,
            userId: interaction.user.id,
            message: card.name,
            timestamp: parsedDate.getTime(),
            createdAt: Date.now(),
            contexte: `Importé depuis Trello: ${listeName}`,
            lien: card.url,
            tag: 'Trello',
            priorite: 'moyenne',
            trelloCardId: card.id
          };
          reminders.push(newReminder);
          imported++;
        }

        await saveReminders(reminders);

        const dateStr = parsedDate.toLocaleString('fr-FR', {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
          hour: '2-digit',
          minute: '2-digit'
        });

        await interaction.editReply({
          content: `✅ **${imported} tâche${imported > 1 ? 's' : ''} importée${imported > 1 ? 's' : ''}** depuis "${listeName}"\n\nRappels programmés pour: **${dateStr}**`
        });
      } catch (error) {
        console.error('Erreur Trello:', error);
        await interaction.editReply({
          content: `❌ Erreur: ${error.message}`
        });
      }
    }

    // COMMANDE: /trello-config
    if (commandName === 'trello-config') {
      try {
        await interaction.deferReply({ flags: 64 }); // 64 = ephemeral

        const boardId = process.env.TRELLO_BOARD_ID;
        if (!boardId) {
          await interaction.editReply({
            content: '❌ Configuration Trello incomplète.\n\nAjoutez dans .env:\n- TRELLO_API_KEY\n- TRELLO_TOKEN\n- TRELLO_BOARD_ID\n\nGuide: https://trello.com/app-key'
          });
          return;
        }

        const board = await trelloRequest(`/boards/${boardId}`);
        const lists = await getTrelloLists(boardId);

        let msg = `✅ **Configuration Trello active**\n\n`;
        msg += `📋 **Tableau:** ${board.name}\n`;
        msg += `🔗 ${board.url}\n\n`;
        msg += `**Listes disponibles:**\n`;
        msg += lists.map(l => `• ${l.name}`).join('\n');

        await interaction.editReply({ content: msg });
      } catch (error) {
        await interaction.editReply({
          content: `❌ Erreur de connexion Trello: ${error.message}\n\nVérifiez vos clés API dans .env`
        });
      }
    }

    // COMMANDE: /trello-webhook-setup
    if (commandName === 'trello-webhook-setup') {
      try {
        await interaction.deferReply({ flags: 64 }); // 64 = ephemeral

        const boardId = process.env.TRELLO_BOARD_ID;
        const webhookUrl = process.env.WEBHOOK_URL;
        const userId = process.env.TRELLO_USER_ID;

        if (!boardId || !webhookUrl) {
          await interaction.editReply({
            content: '❌ Configuration incomplète.\n\nAjoutez dans .env:\n- TRELLO_BOARD_ID\n- WEBHOOK_URL (votre URL ngrok)\n- TRELLO_USER_ID (votre Discord User ID)\n\nVotre User ID: ' + interaction.user.id
          });
          return;
        }

        if (!userId) {
          await interaction.editReply({
            content: `⚠️ TRELLO_USER_ID non configuré.\n\nAjoutez dans .env:\nTRELLO_USER_ID=${interaction.user.id}\n\nPuis relancez le bot.`
          });
          return;
        }

        const callbackURL = `${webhookUrl}/webhook/trello`;

        // Créer le webhook
        const webhook = await createTrelloWebhook(callbackURL, boardId, 'Discord Reminder Bot - Auto Sync');

        // Sauvegarder l'ID du webhook
        const webhookIds = await loadWebhookIds();
        webhookIds.push(webhook.id);
        await saveWebhookIds(webhookIds);

        await interaction.editReply({
          content: `✅ **Webhook Trello configuré avec succès !**\n\n🔗 Callback URL: ${callbackURL}\n📝 Webhook ID: ${webhook.id}\n\n**Synchronisation automatique activée :**\n• Ajout de carte dans "To Do" → 2 rappels créés (10h et 15h)\n• Déplacement vers "Done" → Rappels supprimés\n\nTout est maintenant automatique ! 🎉`
        });
      } catch (error) {
        console.error('Erreur webhook setup:', error);
        await interaction.editReply({
          content: `❌ Erreur: ${error.message}\n\nVérifiez que:\n1. Votre URL ngrok est correcte dans WEBHOOK_URL\n2. Le serveur webhook est accessible\n3. Vos clés Trello sont valides`
        });
      }
    }

    // COMMANDE: /trello-webhook-delete
    if (commandName === 'trello-webhook-delete') {
      try {
        await interaction.deferReply({ flags: 64 }); // 64 = ephemeral

        const webhooks = await listTrelloWebhooks();

        if (webhooks.length === 0) {
          await interaction.editReply({
            content: '📭 Aucun webhook Trello actif.'
          });
          return;
        }

        let deleted = 0;
        for (const webhook of webhooks) {
          try {
            await deleteTrelloWebhook(webhook.id);
            deleted++;
          } catch (error) {
            console.error(`Erreur suppression webhook ${webhook.id}:`, error);
          }
        }

        // Nettoyer le fichier local
        await saveWebhookIds([]);

        await interaction.editReply({
          content: `✅ **${deleted} webhook(s) supprimé(s)**\n\nLa synchronisation automatique est désactivée.`
        });
      } catch (error) {
        console.error('Erreur webhook delete:', error);
        await interaction.editReply({
          content: `❌ Erreur: ${error.message}`
        });
      }
    }

    // COMMANDE: /clear-tout
    if (commandName === 'clear-tout') {
      await interaction.deferReply({ flags: 64 }); // 64 = ephemeral

      const reminders = await loadReminders();
      const userReminders = reminders.filter(r => r.userId === interaction.user.id);

      if (userReminders.length === 0) {
        await interaction.editReply({
          content: '📭 Vous n\'avez aucun rappel à supprimer.'
        });
        return;
      }

      // Créer un bouton de confirmation
      const confirmButton = new ButtonBuilder()
        .setCustomId('confirm_clear_all')
        .setLabel(`⚠️ OUI, supprimer mes ${userReminders.length} rappels`)
        .setStyle(ButtonStyle.Danger);

      const cancelButton = new ButtonBuilder()
        .setCustomId('cancel_clear_all')
        .setLabel('❌ Annuler')
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

      await interaction.editReply({
        content: `⚠️ **ATTENTION**\n\nVous êtes sur le point de supprimer **${userReminders.length} rappel(s)**.\n\n**Cette action est irréversible !**\n\nÊtes-vous sûr ?`,
        components: [row]
      });
    }

    // ==================== COMMANDES GESTION TAGS ====================

    // COMMANDE: /tags-creer
    if (commandName === 'tags-creer') {
      await interaction.deferReply({ flags: 64 });

      const tagName = interaction.options.getString('nom').trim();
      const tagsData = await loadAvailableTags();

      if (tagsData.tags.includes(tagName)) {
        await interaction.editReply({
          content: `❌ Le tag "${tagName}" existe déjà.`
        });
        return;
      }

      tagsData.tags.push(tagName);
      await saveAvailableTags(tagsData);

      await interaction.editReply({
        content: `✅ Tag "${tagName}" créé avec succès !\n\nVous pouvez maintenant l'utiliser pour taguer vos conversations.`
      });
    }

    // COMMANDE: /tags-liste
    if (commandName === 'tags-liste') {
      await interaction.deferReply({ flags: 64 });

      const tagsData = await loadAvailableTags();

      if (tagsData.tags.length === 0 && tagsData.categories.length === 0) {
        await interaction.editReply({
          content: '📭 Aucun tag ou catégorie créé.\n\nUtilisez `/tags-creer` pour créer un tag et `/categorie-creer` pour créer une catégorie.'
        });
        return;
      }

      let message = '📋 **Vos tags et catégories**\n\n';

      if (tagsData.tags.length > 0) {
        message += `🏷️ **Tags disponibles (${tagsData.tags.length}):**\n`;
        message += tagsData.tags.map(t => `• ${t}`).join('\n');
        message += '\n\n';
      }

      if (tagsData.categories.length > 0) {
        message += `📁 **Catégories disponibles (${tagsData.categories.length}):**\n`;
        message += tagsData.categories.map(c => `• ${c}`).join('\n');
      }

      await interaction.editReply({ content: message });
    }

    // COMMANDE: /tags-supprimer
    if (commandName === 'tags-supprimer') {
      await interaction.deferReply({ flags: 64 });

      const tagName = interaction.options.getString('nom').trim();
      const tagsData = await loadAvailableTags();

      if (!tagsData.tags.includes(tagName)) {
        await interaction.editReply({
          content: `❌ Le tag "${tagName}" n'existe pas.`
        });
        return;
      }

      tagsData.tags = tagsData.tags.filter(t => t !== tagName);
      await saveAvailableTags(tagsData);

      // Optionnel: retirer ce tag de toutes les conversations
      const conversations = await loadTaggedConversations();
      let updated = 0;
      conversations.forEach(conv => {
        if (conv.tags.includes(tagName)) {
          conv.tags = conv.tags.filter(t => t !== tagName);
          conv.updatedAt = Date.now();
          updated++;
        }
      });
      if (updated > 0) {
        await saveTaggedConversations(conversations);
      }

      await interaction.editReply({
        content: `✅ Tag "${tagName}" supprimé avec succès !${updated > 0 ? `\n\n${updated} conversation(s) mise(s) à jour.` : ''}`
      });
    }

    // COMMANDE: /categorie-creer
    if (commandName === 'categorie-creer') {
      await interaction.deferReply({ flags: 64 });

      const categorieName = interaction.options.getString('nom').trim();
      const tagsData = await loadAvailableTags();

      if (tagsData.categories.includes(categorieName)) {
        await interaction.editReply({
          content: `❌ La catégorie "${categorieName}" existe déjà.`
        });
        return;
      }

      tagsData.categories.push(categorieName);
      await saveAvailableTags(tagsData);

      await interaction.editReply({
        content: `✅ Catégorie "${categorieName}" créée avec succès !`
      });
    }

    // COMMANDE: /categorie-supprimer
    if (commandName === 'categorie-supprimer') {
      await interaction.deferReply({ flags: 64 });

      const categorieName = interaction.options.getString('nom').trim();
      const tagsData = await loadAvailableTags();

      if (!tagsData.categories.includes(categorieName)) {
        await interaction.editReply({
          content: `❌ La catégorie "${categorieName}" n'existe pas.`
        });
        return;
      }

      tagsData.categories = tagsData.categories.filter(c => c !== categorieName);
      await saveAvailableTags(tagsData);

      await interaction.editReply({
        content: `✅ Catégorie "${categorieName}" supprimée avec succès !`
      });
    }

    // COMMANDE: /conversations-taguees
    if (commandName === 'conversations-taguees') {
      await interaction.deferReply({ flags: 64 });

      const categorieFilter = interaction.options.getString('categorie');
      const conversations = await loadTaggedConversations();
      const userConversations = conversations.filter(c => c.ownerId === interaction.user.id);

      let filtered = userConversations;
      if (categorieFilter) {
        filtered = userConversations.filter(c => c.categorie === categorieFilter);
      }

      if (filtered.length === 0) {
        await interaction.editReply({
          content: categorieFilter
            ? `📭 Aucune conversation taguée dans la catégorie "${categorieFilter}".\n\nUtilisez le menu contextuel (clic droit sur un message) → "Taguer cette conversation".`
            : '📭 Aucune conversation taguée.\n\nUtilisez le menu contextuel (clic droit sur un message) → "Taguer cette conversation".'
        });
        return;
      }

      // Grouper par catégorie
      const grouped = {};
      filtered.forEach(conv => {
        const cat = conv.categorie || 'Sans catégorie';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(conv);
      });

      let message = `📋 **Vos conversations taguées (${filtered.length})**\n\n`;

      for (const [categorie, convs] of Object.entries(grouped)) {
        message += `📁 Catégorie **"${categorie.toUpperCase()}"**\n`;
        convs.forEach(conv => {
          const tagsStr = conv.tags.join(' ; ');
          message += `   • **"${conv.nom}"** (tags: ${tagsStr})`;
          if (conv.messageLink) {
            message += ` - [Lien](${conv.messageLink})`;
          }
          message += '\n';
        });
        message += '\n';
      }

      // Si le message est trop long, le tronquer
      if (message.length > 2000) {
        message = message.substring(0, 1900) + '\n\n... _(liste tronquée)_';
      }

      await interaction.editReply({ content: message });
    }

    // COMMANDE: /conversations-par-tag
    if (commandName === 'conversations-par-tag') {
      await interaction.deferReply({ flags: 64 });

      const tag = interaction.options.getString('tag');
      const conversations = await loadTaggedConversations();
      const userConversations = conversations.filter(c => c.ownerId === interaction.user.id);
      const filtered = userConversations.filter(c => c.tags.includes(tag));

      if (filtered.length === 0) {
        await interaction.editReply({
          content: `📭 Aucune conversation avec le tag "${tag}".`
        });
        return;
      }

      let message = `🏷️ **Conversations avec le tag "${tag}" (${filtered.length})**\n\n`;

      filtered.forEach(conv => {
        const tagsStr = conv.tags.join(' ; ');
        message += `• **"${conv.nom}"** (tags: ${tagsStr})`;
        if (conv.categorie) {
          message += ` - Catégorie: **${conv.categorie}**`;
        }
        if (conv.messageLink) {
          message += ` - [Lien](${conv.messageLink})`;
        }
        message += '\n';
      });

      if (message.length > 2000) {
        message = message.substring(0, 1900) + '\n\n... _(liste tronquée)_';
      }

      await interaction.editReply({ content: message });
    }

    // COMMANDE: /conversation-modifier
    if (commandName === 'conversation-modifier') {
      await interaction.deferReply({ flags: 64 });

      const nom = interaction.options.getString('nom');
      const conversations = await loadTaggedConversations();
      const conv = conversations.find(c => c.ownerId === interaction.user.id && c.nom.toLowerCase() === nom.toLowerCase());

      if (!conv) {
        await interaction.editReply({
          content: `❌ Aucune conversation trouvée avec le nom "${nom}".\n\nUtilisez \`/conversations-taguees\` pour voir toutes vos conversations.`
        });
        return;
      }

      // Créer un modal pour modifier
      const modal = new ModalBuilder()
        .setCustomId(`edit_conversation_modal_${conv.conversationId}`)
        .setTitle(`Modifier: ${conv.nom}`);

      const tagsData = await loadAvailableTags();

      const nomInput = new TextInputBuilder()
        .setCustomId('nom')
        .setLabel('Nom')
        .setStyle(TextInputStyle.Short)
        .setValue(conv.nom)
        .setRequired(true);

      const tagsInput = new TextInputBuilder()
        .setCustomId('tags')
        .setLabel('Tags (séparés par des virgules)')
        .setStyle(TextInputStyle.Short)
        .setValue(conv.tags.join(', '))
        .setRequired(true);

      const categorieInput = new TextInputBuilder()
        .setCustomId('categorie')
        .setLabel('Catégorie (optionnel)')
        .setStyle(TextInputStyle.Short)
        .setValue(conv.categorie || '')
        .setRequired(false);

      const row1 = new ActionRowBuilder().addComponents(nomInput);
      const row2 = new ActionRowBuilder().addComponents(tagsInput);
      const row3 = new ActionRowBuilder().addComponents(categorieInput);

      modal.addComponents(row1, row2, row3);

      await interaction.showModal(modal);
    }

    // COMMANDE: /conversation-supprimer
    if (commandName === 'conversation-supprimer') {
      await interaction.deferReply({ flags: 64 });

      const nom = interaction.options.getString('nom');
      const conversations = await loadTaggedConversations();
      const index = conversations.findIndex(c => c.ownerId === interaction.user.id && c.nom.toLowerCase() === nom.toLowerCase());

      if (index === -1) {
        await interaction.editReply({
          content: `❌ Aucune conversation trouvée avec le nom "${nom}".\n\nUtilisez \`/conversations-taguees\` pour voir toutes vos conversations.`
        });
        return;
      }

      const deleted = conversations[index];
      conversations.splice(index, 1);
      await saveTaggedConversations(conversations);

      await interaction.editReply({
        content: `✅ Conversation "${deleted.nom}" supprimée des tags.`
      });
    }
  }

  // Gérer les boutons
  if (interaction.isButton()) {
    // Bouton de confirmation clear-tout
    if (interaction.customId === 'confirm_clear_all') {
      const reminders = await loadReminders();
      const userReminders = reminders.filter(r => r.userId === interaction.user.id);
      const remainingReminders = reminders.filter(r => r.userId !== interaction.user.id);

      await saveReminders(remainingReminders);

      await interaction.update({
        content: `✅ **${userReminders.length} rappel(s) supprimé(s)**\n\nToutes vos données ont été effacées.`,
        components: []
      });
      return;
    }

    // Bouton d'annulation clear-tout
    if (interaction.customId === 'cancel_clear_all') {
      await interaction.update({
        content: '❌ **Suppression annulée**\n\nVos rappels sont conservés.',
        components: []
      });
      return;
    }

    const [action, reminderId] = interaction.customId.split('_');

    const reminders = await loadReminders();
    const reminderIndex = reminders.findIndex(r => r.id === parseInt(reminderId));

    if (reminderIndex === -1) {
      await interaction.reply({
        content: '❌ Rappel introuvable.',
        flags: 64 // ephemeral
      });
      return;
    }

    const reminder = reminders[reminderIndex];

    // Bouton "Fait"
    if (action === 'done') {
      // Si lié à Trello, déplacer vers "Done"
      if (reminder.trelloCardId) {
        try {
          const boardId = process.env.TRELLO_BOARD_ID;
          const lists = await getTrelloLists(boardId);
          const doneList = lists.find(l => l.name.toLowerCase().includes('done') || l.name.toLowerCase().includes('fait'));

          if (doneList) {
            await moveTrelloCard(reminder.trelloCardId, doneList.id);
          }
        } catch (error) {
          console.error('Erreur déplacement Trello:', error);
        }
      }

      reminders.splice(reminderIndex, 1);
      await saveReminders(reminders);

      await interaction.update({
        content: interaction.message.content + '\n\n✅ **Marqué comme fait !**',
        components: []
      });
    }

    // Bouton "Snooze 1h"
    if (action === 'snooze1h') {
      reminder.timestamp = Date.now() + (60 * 60 * 1000);
      reminder.sent = false; // Réinitialiser pour qu'il soit renvoyé
      delete reminder.sentAt;
      reminders[reminderIndex] = reminder;
      await saveReminders(reminders);

      await interaction.update({
        content: interaction.message.content + '\n\n⏰ **Reporté d\'1 heure**',
        components: []
      });
    }

    // Bouton "Snooze demain"
    if (action === 'snoozetomorrow') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      reminder.timestamp = tomorrow.getTime();
      reminder.sent = false; // Réinitialiser pour qu'il soit renvoyé
      delete reminder.sentAt;
      reminders[reminderIndex] = reminder;
      await saveReminders(reminders);

      await interaction.update({
        content: interaction.message.content + '\n\n📅 **Reporté à demain 9h**',
        components: []
      });
    }
  }

  // Gérer les menus déroulants (Select Menus)
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'delete_reminders') {
      const selectedIds = interaction.values.map(id => parseInt(id));
      const reminders = await loadReminders();

      // Filtrer les rappels à garder
      const remainingReminders = reminders.filter(r => !selectedIds.includes(r.id) || r.userId !== interaction.user.id);
      const deletedCount = reminders.length - remainingReminders.length;

      await saveReminders(remainingReminders);

      await interaction.update({
        content: `✅ **${deletedCount} rappel(s) supprimé(s)**\n\n${interaction.message.content}`,
        components: []
      });
    }
  }

  // Gérer les soumissions de modals
  if (interaction.isModalSubmit()) {
    // Modal: Créer un rappel depuis un message
    if (interaction.customId.startsWith('reminder_modal_')) {
      await interaction.deferReply({ flags: 64 }); // ephemeral

      const messageId = interaction.customId.replace('reminder_modal_', '');
      const quand = interaction.fields.getTextInputValue('quand');
      const note = interaction.fields.getTextInputValue('note') || null;

      // Parser la date avec chrono
      const parsedDate = chrono.fr.parseDate(quand, new Date());

      if (!parsedDate || parsedDate <= new Date()) {
        await interaction.editReply({
          content: `❌ Je n'ai pas pu comprendre "${quand}". Essayez: "demain 14h", "dans 2 heures", "lundi 9h"`
        });
        return;
      }

      // Récupérer l'URL du message depuis le cache
      const messageLink = messageUrlCache.get(messageId) || null;

      // Créer le rappel avec un meilleur message
      const reminders = await loadReminders();

      // Construire le message du rappel
      let rappelMessage = note || 'Voir le message enregistré';

      const newReminder = {
        id: Date.now(),
        userId: interaction.user.id,
        message: rappelMessage,
        timestamp: parsedDate.getTime(),
        createdAt: Date.now(),
        contexte: null,
        lien: messageLink,
        tag: null,
        priorite: 'moyenne',
        trelloCardId: null
      };

      reminders.push(newReminder);
      await saveReminders(reminders);

      const dateStr = parsedDate.toLocaleString('fr-FR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit'
      });

      await interaction.editReply({
        content: `✅ **Rappel créé pour ${dateStr}**\n\n📋 ${rappelMessage}\n🔗 Lien enregistré vers le message`
      });
    }

    // Modal: Taguer une conversation (création/modification)
    if (interaction.customId.startsWith('tag_conversation_modal_')) {
      try {
        console.log('📝 Modal de tag soumis');
        await interaction.deferReply({ flags: 64 });

        const conversationId = interaction.customId.replace('tag_conversation_modal_', '');
        console.log('🆔 Conversation ID:', conversationId);

        const nom = interaction.fields.getTextInputValue('nom').trim();
        const tagsStr = interaction.fields.getTextInputValue('tags').trim();
        const categorie = interaction.fields.getTextInputValue('categorie')?.trim() || null;

        console.log('📋 Données reçues:', { nom, tagsStr, categorie });

        // Parser les tags (séparés par des virgules)
        const tags = tagsStr.split(',').map(t => t.trim()).filter(t => t.length > 0);

        if (tags.length === 0) {
          await interaction.editReply({
            content: '❌ Vous devez spécifier au moins un tag.'
          });
          return;
        }

        // Construire l'URL du message
        const messageLink = `https://discord.com/channels/@me/${conversationId}`;

        const conversationData = {
          conversationId,
          ownerId: interaction.user.id,
          nom,
          tags,
          categorie,
          messageLink
        };

        console.log('💾 Tentative de sauvegarde...');
        const result = await createOrUpdateTaggedConversation(conversationData);
        console.log('✅ Sauvegarde réussie:', result.isNew ? 'nouvelle' : 'mise à jour');

        const tagsStr2 = tags.map(t => `\`${t}\``).join(' ');

        if (result.isNew) {
          await interaction.editReply({
            content: `✅ **Conversation taguée avec succès !**\n\n👤 **Nom:** ${nom}\n🏷️ **Tags:** ${tagsStr2}${categorie ? `\n📁 **Catégorie:** ${categorie}` : ''}\n\nUtilisez \`/conversations-taguees\` pour voir toutes vos conversations taguées.`
          });
        } else {
          await interaction.editReply({
            content: `✅ **Conversation mise à jour !**\n\n👤 **Nom:** ${nom}\n🏷️ **Tags:** ${tagsStr2}${categorie ? `\n📁 **Catégorie:** ${categorie}` : ''}\n\n_Cette conversation était déjà taguée, les informations ont été mises à jour._`
          });
        }
      } catch (error) {
        console.error('❌ Erreur dans le modal de tag:', error);
        await interaction.editReply({
          content: `❌ Erreur: ${error.message}`
        });
      }
    }

    // Modal: Modifier une conversation existante
    if (interaction.customId.startsWith('edit_conversation_modal_')) {
      await interaction.deferReply({ flags: 64 });

      const conversationId = interaction.customId.replace('edit_conversation_modal_', '');
      const nom = interaction.fields.getTextInputValue('nom').trim();
      const tagsStr = interaction.fields.getTextInputValue('tags').trim();
      const categorie = interaction.fields.getTextInputValue('categorie')?.trim() || null;

      // Parser les tags
      const tags = tagsStr.split(',').map(t => t.trim()).filter(t => t.length > 0);

      if (tags.length === 0) {
        await interaction.editReply({
          content: '❌ Vous devez spécifier au moins un tag.'
        });
        return;
      }

      // Mettre à jour la conversation
      const conversations = await loadTaggedConversations();
      const conv = conversations.find(c => c.conversationId === conversationId && c.ownerId === interaction.user.id);

      if (!conv) {
        await interaction.editReply({
          content: '❌ Conversation introuvable.'
        });
        return;
      }

      conv.nom = nom;
      conv.tags = tags;
      conv.categorie = categorie;
      conv.updatedAt = Date.now();

      await saveTaggedConversations(conversations);

      const tagsStr2 = tags.map(t => `\`${t}\``).join(' ');

      await interaction.editReply({
        content: `✅ **Conversation mise à jour !**\n\n👤 **Nom:** ${nom}\n🏷️ **Tags:** ${tagsStr2}${categorie ? `\n📁 **Catégorie:** ${categorie}` : ''}`
      });
    }
  }
  } catch (error) {
    console.error('Erreur dans le handler d\'interaction:', error);
    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({ content: '❌ Une erreur est survenue. Réessayez.', flags: 64 });
      } catch (e) {
        console.error('Impossible de répondre:', e);
      }
    }
  }
});

// ==================== VÉRIFIER ET ENVOYER LES RAPPELS ====================

async function checkReminders() {
  const now = Date.now();
  const reminders = await loadReminders();
  let modified = false;

  for (const reminder of reminders) {
    // Ne traiter que les rappels dont l'heure est dépassée et qui n'ont pas encore été envoyés
    if (reminder.timestamp <= now && !reminder.sent) {
      try {
        const user = await client.users.fetch(reminder.userId);

        // Construire le message du rappel
        const prioriteEmoji = { haute: '🔴', moyenne: '🟡', basse: '🟢' }[reminder.priorite];
        let rappelMsg = `⏰ **RAPPEL** ${prioriteEmoji}\n\n📋 **Tâche :** ${reminder.message}`;
        if (reminder.tag) rappelMsg += `\n🏷️ **Tag :** ${reminder.tag}`;
        if (reminder.contexte) rappelMsg += `\n\n👤 **Contexte :** ${reminder.contexte}`;
        if (reminder.lien) rappelMsg += `\n\n🔗 **Lien vers le message :** ${reminder.lien}\n_Cliquez sur le lien pour voir le message d'origine ↑_`;

        // Créer les boutons Snooze
        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`done_${reminder.id}`)
              .setLabel('✅ Fait')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId(`snooze1h_${reminder.id}`)
              .setLabel('⏰ +1h')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId(`snoozetomorrow_${reminder.id}`)
              .setLabel('📅 Demain')
              .setStyle(ButtonStyle.Secondary)
          );

        await user.send({
          content: rappelMsg,
          components: [row]
        });

        // Marquer comme envoyé mais le garder dans la liste pour les boutons
        reminder.sent = true;
        reminder.sentAt = Date.now();
        modified = true;

        console.log(`Rappel envoyé à ${user.tag}: ${reminder.message}`);
      } catch (error) {
        console.error(`Erreur lors de l'envoi du rappel ${reminder.id}:`, error);
      }
    }
  }

  // Nettoyer les rappels envoyés depuis plus de 1 heure (boutons expirés)
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  const cleanedReminders = reminders.filter(r => {
    if (r.sent && r.sentAt && r.sentAt < oneHourAgo) {
      console.log(`🗑️ Nettoyage du rappel expiré: ${r.id}`);
      return false;
    }
    return true;
  });

  if (modified || cleanedReminders.length !== reminders.length) {
    await saveReminders(cleanedReminders);
  }
}

// ==================== DÉMARRAGE DU BOT ====================

client.once('ready', async () => {
  console.log(`✅ Bot connecté en tant que ${client.user.tag}`);

  // Initialiser les fichiers de tags
  await initializeTagsFiles();

  console.log('📦 Fonctionnalités activées:');
  console.log('   - Raccourcis temporels (demain, dans 2h, etc.)');
  console.log('   - Tags et priorités');
  console.log('   - Boutons Snooze');
  console.log('   - Système de tags pour conversations ✓');
  if (process.env.TRELLO_API_KEY && process.env.TRELLO_TOKEN) {
    console.log('   - Intégration Trello ✓');
    if (process.env.WEBHOOK_URL) {
      console.log('   - Webhooks Trello (automatisation) ✓');
    } else {
      console.log('   - Webhooks Trello (non configuré - ajoutez WEBHOOK_URL)');
    }
  } else {
    console.log('   - Intégration Trello (non configurée)');
  }

  // Vérification des rappels toutes les 30 secondes
  setInterval(checkReminders, 30000);
  checkReminders();
});

async function start() {
  await registerCommands();
  await client.login(process.env.DISCORD_TOKEN);
}

start().catch(console.error);
