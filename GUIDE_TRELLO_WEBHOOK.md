# Guide : Configuration des Webhooks Trello (Synchronisation Automatique)

Ce guide vous explique comment activer la synchronisation automatique entre Trello et Discord, pour que vos tâches Trello créent automatiquement des rappels Discord.

## 🎯 Résultat Final

Une fois configuré :
- ✅ Vous ajoutez une carte dans "To Do" sur Trello → 2 rappels créés automatiquement (10h et 15h)
- ✅ Vous déplacez une carte vers "Done" → Rappels supprimés automatiquement
- ✅ Vous cliquez "Fait" sur un rappel Discord → Carte déplacée vers "Done" sur Trello

C'est 100% automatique !

---

## Prérequis

1. Avoir configuré votre bot Discord (token, client ID)
2. Avoir configuré l'API Trello (API key, token, board ID)
3. Installer ngrok (pour exposer votre bot local sur internet)

---

## Étape 1 : Installer ngrok

### Sur Mac
```bash
brew install ngrok
```

### Sur Windows
1. Téléchargez ngrok : https://ngrok.com/download
2. Décompressez le fichier
3. Placez `ngrok.exe` dans un dossier accessible

### Sur Linux
```bash
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
sudo apt update && sudo apt install ngrok
```

---

## Étape 2 : Créer un compte ngrok (GRATUIT)

1. Allez sur https://ngrok.com/
2. Créez un compte gratuit
3. Allez dans **"Your Authtoken"** : https://dashboard.ngrok.com/get-started/your-authtoken
4. Copiez votre authtoken

5. Configurez ngrok avec votre token :
```bash
ngrok config add-authtoken VOTRE_TOKEN_ICI
```

---

## Étape 3 : Démarrer ngrok

**IMPORTANT** : Ouvrez un NOUVEAU terminal (gardez celui du bot ouvert)

Dans ce nouveau terminal, tapez :
```bash
ngrok http 3000
```

Vous devriez voir quelque chose comme :
```
Forwarding   https://abc123def456.ngrok-free.app -> http://localhost:3000
```

**⚠️ COPIEZ L'URL https://abc123def456.ngrok-free.app** (elle change à chaque redémarrage de ngrok)

---

## Étape 4 : Configurer le fichier .env

Ajoutez ces lignes dans votre fichier `.env` :

```env
# Webhooks Trello
WEBHOOK_PORT=3000
WEBHOOK_URL=https://abc123def456.ngrok-free.app
TRELLO_USER_ID=votre_discord_user_id
```

### Comment trouver votre Discord User ID ?

**Méthode 1 : Via le bot**
1. Tapez `/trello-webhook-setup`
2. Le bot vous donnera votre User ID dans le message d'erreur

**Méthode 2 : Manuellement**
1. Ouvrez Discord
2. Allez dans **Paramètres > Avancés**
3. Activez **"Mode développeur"**
4. Faites clic droit sur votre nom → **"Copier l'identifiant"**

---

## Étape 5 : Redémarrer le bot

Dans le terminal où tourne votre bot :

1. Arrêtez le bot : **Ctrl + C**
2. Relancez-le :
```bash
npm start
```

Vous devriez voir :
```
✅ Bot connecté en tant que RemindMe#6599
🌐 Serveur webhook démarré sur le port 3000
   - Webhooks Trello (automatisation) ✓
```

---

## Étape 6 : Activer le webhook Trello

Sur Discord, dans votre DM avec le bot, tapez :

```
/trello-webhook-setup
```

Si tout est configuré correctement, vous recevrez :
```
✅ Webhook Trello configuré avec succès !

Synchronisation automatique activée :
• Ajout de carte dans "To Do" → 2 rappels créés (10h et 15h)
• Déplacement vers "Done" → Rappels supprimés

Tout est maintenant automatique ! 🎉
```

---

## ✅ Tester la synchronisation

### Test 1 : Ajouter une carte
1. Allez sur votre tableau Trello
2. Ajoutez une carte dans "To Do" (ex: "Tester le webhook")
3. Vous devriez recevoir un message Discord :
   ```
   🆕 Nouvelle tâche Trello ajoutée

   📋 Tester le webhook

   ⏰ Vous recevrez 2 rappels : à 10h et 15h
   ```

### Test 2 : Déplacer vers Done
1. Sur Trello, déplacez la carte vers "Done"
2. Vous devriez recevoir :
   ```
   ✅ Tâche Trello terminée

   📋 Tester le webhook

   2 rappel(s) supprimé(s)
   ```

---

## 🔧 Dépannage

### Le webhook ne marche pas

**Vérifiez que ngrok tourne :**
```bash
# Dans un terminal, vérifiez que ngrok est actif
curl https://votre-url-ngrok.ngrok-free.app/webhook/trello -I
```

Vous devriez voir : `HTTP/2 200`

**Vérifiez que le serveur webhook est actif :**
- Le bot affiche-t-il "🌐 Serveur webhook démarré sur le port 3000" au démarrage ?

**Vérifiez votre WEBHOOK_URL dans .env :**
- Assurez-vous qu'il commence par `https://`
- Assurez-vous qu'il correspond à l'URL affichée par ngrok

**Vérifiez TRELLO_USER_ID :**
```bash
# Le User ID doit être un nombre long, par exemple : 123456789012345678
```

### Supprimer tous les webhooks

Si vous avez créé plusieurs webhooks par erreur :
```
/trello-webhook-delete
```

Puis recréez-en un avec :
```
/trello-webhook-setup
```

---

## 📝 Notes importantes

### ngrok gratuit
- L'URL change à chaque redémarrage de ngrok
- Si vous redémarrez ngrok, vous devez :
  1. Copier la nouvelle URL
  2. Mettre à jour `WEBHOOK_URL` dans `.env`
  3. Relancer le bot
  4. Refaire `/trello-webhook-delete` puis `/trello-webhook-setup`

### Version payante de ngrok (optionnel)
- URL fixe qui ne change jamais
- Plus de stabilité
- ~$8/mois

### Alternative : Déployer sur un serveur
Pour une solution permanente, déployez votre bot sur :
- **Railway** (gratuit pour commencer) : https://railway.app/
- **Heroku** ($5-7/mois)
- **VPS** (ex: DigitalOcean, $4/mois)

Avec un serveur, plus besoin de ngrok !

---

## 🎉 Prêt !

Vous avez maintenant une synchronisation bidirectionnelle complète entre Trello et Discord !

**Workflow recommandé :**
1. Ajoutez vos tâches dans Trello "To Do"
2. Recevez automatiquement 2 rappels Discord (10h et 15h)
3. Quand vous recevez le rappel, cliquez "✅ Fait"
4. La carte Trello se déplace automatiquement vers "Done"

C'est magique ! ✨
