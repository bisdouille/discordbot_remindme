# Discord Reminder Bot

Un bot Discord pour créer des rappels automatiques en messages privés, similaire à la fonctionnalité de Slack.

## Fonctionnalités

### Rappels
- Créer des rappels avec un délai personnalisé (jours, heures, minutes)
- Recevoir des notifications en message privé
- Voir tous vos rappels actifs
- Supprimer des rappels
- Tags et priorités
- Dates naturelles ("demain 14h", "dans 2h")
- Boutons Snooze interactifs

### Système de Tags pour Conversations (Nouveau !)
- Taguer vos conversations Discord avec des tags personnalisés
- Organiser par catégories (Clients, Partenaires, etc.)
- Retrouver facilement vos conversations par tag
- Filtrer et rechercher vos contacts
- Prévention automatique des doublons
- [Guide complet des tags](GUIDE_TAGS.md)

## Installation

### 1. Créer votre bot Discord

1. Allez sur [Discord Developer Portal](https://discord.com/developers/applications)
2. Cliquez sur "New Application"
3. Donnez un nom à votre application
4. Allez dans l'onglet "Bot"
5. Cliquez sur "Add Bot"
6. Copiez le token (vous en aurez besoin)
7. Activez les "Privileged Gateway Intents" :
   - MESSAGE CONTENT INTENT (si nécessaire)
8. Allez dans l'onglet "OAuth2" > "URL Generator"
9. Cochez les scopes :
   - `bot`
   - `applications.commands`
10. Cochez les permissions :
   - Send Messages
   - Read Messages/View Channels
11. Copiez l'URL générée et ouvrez-la pour inviter le bot sur votre serveur

### 2. Configuration du projet

```bash
# Installer les dépendances
npm install

# Copier le fichier .env.example vers .env
cp .env.example .env
```

### 3. Configurer les variables d'environnement

Éditez le fichier `.env` et remplissez :

```
DISCORD_TOKEN=votre_token_du_bot
CLIENT_ID=votre_client_id
```

Pour trouver votre CLIENT_ID :
1. Retournez sur [Discord Developer Portal](https://discord.com/developers/applications)
2. Sélectionnez votre application
3. L'Application ID se trouve dans l'onglet "General Information"

### 4. Lancer le bot

```bash
npm start
```

Ou en mode développement avec auto-reload :

```bash
npm run dev
```

## Utilisation

### Commandes disponibles

#### `/rappel` - Créer un rappel

Créez un rappel qui vous sera envoyé en message privé après le délai spécifié.

**Paramètres :**
- `message` (requis) : Le message du rappel
- `jours` (optionnel) : Nombre de jours
- `heures` (optionnel) : Nombre d'heures
- `minutes` (optionnel) : Nombre de minutes

**Exemples :**
```
/rappel message:"Répondre à Jerry" jours:3
/rappel message:"Réunion importante" heures:2 minutes:30
/rappel message:"Faire les courses" jours:1 heures:6
```

#### `/mes-rappels` - Voir vos rappels

Affiche la liste de tous vos rappels actifs avec leur ID et date d'échéance.

#### `/supprimer-rappel` - Supprimer un rappel

Supprime un rappel en utilisant son ID.

**Paramètres :**
- `id` (requis) : L'ID du rappel à supprimer

**Exemple :**
```
/supprimer-rappel id:1729876543210
```

### Commandes de gestion des tags (Nouveau !)

#### 🏷️ Gestion des tags

- `/tags-creer` - Créer un nouveau tag
- `/tags-liste` - Voir tous les tags disponibles
- `/tags-supprimer` - Supprimer un tag

#### 📁 Gestion des catégories

- `/categorie-creer` - Créer une nouvelle catégorie
- `/categorie-supprimer` - Supprimer une catégorie

#### 💬 Taguer des conversations

- **Clic droit sur message** → "Taguer cette conversation" - Taguer/modifier une conversation
- `/conversations-taguees` - Voir toutes vos conversations taguées
- `/conversations-par-tag` - Filtrer par tag spécifique
- `/conversation-modifier` - Modifier les tags d'une conversation
- `/conversation-supprimer` - Retirer une conversation des tags

**Pour plus de détails, consultez le [Guide complet des tags](GUIDE_TAGS.md)**

## Architecture

- `index.js` : Fichier principal du bot
- `reminders.json` : Stockage des rappels (créé automatiquement)
- `tagged-conversations.json` : Stockage des conversations taguées (créé automatiquement)
- `available-tags.json` : Liste des tags et catégories (créé automatiquement)
- `trello-webhooks.json` : IDs des webhooks Trello (créé automatiquement)
- `.env` : Variables d'environnement (token et client ID)

## Notes importantes

- Le bot vérifie les rappels toutes les 30 secondes
- Les rappels sont stockés localement dans `reminders.json`
- Assurez-vous que le bot reste actif pour envoyer les rappels
- Les rappels sont envoyés en messages privés (DM)

## Améliorations possibles

- Utiliser une base de données (SQLite, PostgreSQL)
- Ajouter des rappels récurrents
- Supporter des formats de date naturels ("demain à 14h")
- Ajouter des rappels contextuels (depuis un message)
- Notifications push
- Interface web de gestion

## Licence

ISC
