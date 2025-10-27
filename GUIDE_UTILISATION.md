# 📖 Guide d'Utilisation - Discord Reminder Bot

Bot Discord pour créer des rappels automatiques et synchroniser vos tâches Trello.

---

## 🚀 Commandes Rapides

### `/rappel-rapide` - Créer un rappel en langage naturel

La façon la plus rapide de créer un rappel !

**Exemples :**
```
/rappel-rapide quand:"demain 14h" message:"Appeler le client"
/rappel-rapide quand:"dans 2 heures" message:"Réunion d'équipe"
/rappel-rapide quand:"lundi 9h" message:"Envoyer le rapport"
/rappel-rapide quand:"vendredi" message:"Point hebdo" tag:"Travail"
```

**Formats acceptés :**
- `demain 14h`, `demain matin`, `demain soir`
- `dans 2 heures`, `dans 30 minutes`, `dans 3 jours`
- `lundi`, `mardi`, `vendredi 15h`
- `lundi prochain 10h`

---

### `/rappel` - Créer un rappel détaillé

Pour plus de contrôle sur vos rappels.

**Paramètres :**
- `message` (requis) : Le message du rappel
- `jours` : Nombre de jours
- `heures` : Nombre d'heures
- `minutes` : Nombre de minutes
- `contexte` : Contexte du rappel
- `lien` : Lien vers un message Discord
- `tag` : Catégorie (ex: "Client A", "Urgent")
- `priorite` : haute 🔴 / moyenne 🟡 / basse 🟢

**Exemples :**
```
/rappel message:"Résilier abonnement" jours:1 priorite:"haute"

/rappel message:"Répondre à Jerry" heures:3
        contexte:"Message urgent" tag:"Travail"

/rappel message:"Envoyer devis" jours:2
        lien:[lien Discord] priorite:"haute" tag:"Client A"
```

**Astuce : Copier le lien d'un message Discord**
1. Clic droit sur un message → "Copier le lien du message"
2. Collez-le dans le champ `lien`
3. Le rappel contiendra un lien cliquable vers le message !

---

### `/mes-rappels` - Voir tous vos rappels

Affiche tous vos rappels actifs, triés par priorité puis par date.

```
/mes-rappels
```

**Résultat :**
```
📋 Vos rappels actifs (5):

🔴 ID 1234: Envoyer devis urgent
   ⏰ 28/10/2025, 10:00
   🏷️ Client A
   👤 Message de mon boss
   🔗 [lien Discord]

🟡 ID 1235: Réunion équipe
   ⏰ 28/10/2025, 14:00
   🏷️ Travail
```

---

### `/rappels-par-tag` - Filtrer par catégorie

Voir seulement les rappels d'une catégorie spécifique.

**Exemples :**
```
/rappels-par-tag tag:"Client A"
/rappels-par-tag tag:"Urgent"
/rappels-par-tag tag:"Trello"
```

---

### `/supprimer-rappel` - Supprimer un rappel

**Syntaxe :**
```
/supprimer-rappel id:1234
```

Trouvez l'ID avec `/mes-rappels`.

---

## 🔔 Réception des Rappels

Quand vous recevez un rappel, vous avez **3 boutons** :

- **✅ Fait** : Marque la tâche comme terminée
  - Si c'est une tâche Trello → Elle est déplacée vers "Done" automatiquement
- **⏰ +1h** : Reporter le rappel d'1 heure
- **📅 Demain** : Reporter à demain 9h

**Exemple de rappel reçu :**
```
⏰ RAPPEL 🔴

📋 Tâche : Envoyer le devis au client

🏷️ Tag : Client A
👤 Contexte : Message urgent du boss
🔗 Lien vers le message : [cliquer ici]

[✅ Fait] [⏰ +1h] [📅 Demain]
```

---

## 🔄 Synchronisation Trello (Automatique)

### Comment ça marche ?

**1. Vous créez une tâche dans "To Do" sur Trello**
→ Vous recevez un message Discord : "Nouvelle tâche Trello ajoutée"
→ **2 rappels sont créés automatiquement** : à 10h ET 15h

**2. Vous modifiez la tâche** (nom, description, etc.)
→ Pas de notification Discord (pas de spam !)
→ Les rappels sont mis à jour automatiquement

**3. Vous cliquez "✅ Fait" sur un rappel**
→ La carte Trello est déplacée vers "Done" automatiquement

**4. Vous déplacez manuellement vers "Done" sur Trello**
→ Les rappels Discord sont supprimés automatiquement

### Commandes Trello

#### `/trello-import` - Import manuel

Importer toutes les tâches d'une liste Trello.

**Exemple :**
```
/trello-import liste:"To Do" quand:"demain 9h"
```

Toutes les cartes de "To Do" deviennent des rappels pour demain 9h.

#### `/trello-config` - Vérifier la configuration

```
/trello-config
```

Affiche votre tableau Trello connecté et les listes disponibles.

#### `/trello-webhook-setup` - Activer la synchronisation automatique

```
/trello-webhook-setup
```

Active la synchronisation bidirectionnelle Trello ↔ Discord.

#### `/trello-webhook-delete` - Désactiver la synchronisation

```
/trello-webhook-delete
```

Désactive tous les webhooks Trello.

---

## 💡 Cas d'Usage Pratiques

### Cas 1 : Rappel depuis un message Discord

**Situation :** Votre boss vous envoie un message important

**Workflow :**
1. Clic droit sur le message → "Copier le lien du message"
2. `/rappel-rapide quand:"dans 3 jours" message:"Répondre au boss"`
3. Collez le lien dans le champ `lien` (optionnel mais recommandé)

**Résultat :** Dans 3 jours, vous recevez un rappel avec un lien direct vers le message !

---

### Cas 2 : Gestion de projet par tag

**Situation :** Vous gérez plusieurs clients

**Workflow :**
```
/rappel message:"Envoyer facture" jours:7 tag:"Client A" priorite:"haute"
/rappel message:"Suivi projet" jours:3 tag:"Client A"
/rappel message:"Devis à préparer" jours:2 tag:"Client B" priorite:"haute"
```

**Voir par client :**
```
/rappels-par-tag tag:"Client A"
/rappels-par-tag tag:"Client B"
```

---

### Cas 3 : Workflow Trello automatisé

**Situation :** Vous utilisez Trello pour organiser vos tâches

**Workflow :**
1. Ajoutez vos tâches dans "To Do" sur Trello
2. Recevez automatiquement 2 rappels par jour (10h et 15h)
3. Quand vous finissez, cliquez "✅ Fait" dans Discord
4. La carte Trello passe en "Done" automatiquement

**Aucune action manuelle nécessaire !**

---

## 🎯 Astuces Pro

### 1. Utilisez les priorités

Vos rappels sont triés automatiquement :
- 🔴 Haute : Apparaît en premier
- 🟡 Moyenne : Par défaut
- 🟢 Basse : Moins urgent

### 2. Organisez avec des tags

Créez vos propres catégories :
- "Client A", "Client B", "Client C"
- "Urgent", "Important", "À faire"
- "Perso", "Pro", "Maison"

### 3. Contexte pour la mémoire

Ajoutez toujours un contexte pour vous souvenir :
```
/rappel message:"Appeler Jean" jours:1
        contexte:"Pour le projet de refonte du site"
```

### 4. Snooze intelligent

Occupé quand vous recevez un rappel ?
- **+1h** : Pour les tâches rapides que vous ferez bientôt
- **Demain** : Pour reporter au lendemain matin (9h)

### 5. Workflow DM avec le bot

**Gardez toujours un DM ouvert avec le bot** pour créer des rappels rapidement :
1. Clic droit sur le bot → "Message"
2. Gardez cet onglet ouvert
3. Créez des rappels en quelques secondes !

---

## ⚙️ Configuration Initiale (Déjà faite)

Votre bot est déjà configuré et tourne 24/7 sur Railway !

**Ce qui est actif :**
- ✅ Bot Discord en ligne
- ✅ Serveur webhook (port 3000)
- ✅ Intégration Trello
- ✅ Synchronisation automatique
- ✅ Hébergement 24/7

**Variables configurées :**
- Discord Token & Client ID
- Trello API Key & Token
- Tableau Trello "To do Ambroise"
- Webhook URL Railway
- Votre Discord User ID

---

## 📊 Fonctionnalités en Bref

| Fonctionnalité | Description |
|---|---|
| **Raccourcis temporels** | "demain 14h", "dans 2h", "lundi" |
| **Tags & Priorités** | Organisez et triez vos rappels |
| **Boutons Snooze** | Reporter d'1h ou à demain |
| **Liens Discord** | Lien direct vers les messages |
| **Import Trello** | Importer des listes entières |
| **Sync automatique** | Trello ↔ Discord bidirectionnel |
| **2 rappels/jour** | 10h et 15h pour chaque tâche Trello |
| **0 spam** | Mises à jour silencieuses pendant 5min |
| **24/7** | Hébergé sur Railway |

---

## 🆘 Dépannage

### Le bot ne répond pas

1. Vérifiez que le bot est en ligne sur votre serveur Discord
2. Allez sur Railway → Vérifiez que le déploiement est actif
3. Consultez les logs dans Railway → "Deployments" → Dernier déploiement

### Les commandes n'apparaissent pas

1. Attendez 5-10 minutes (Discord peut prendre du temps)
2. Redémarrez Discord
3. Tapez `/` et cherchez "rappel"

### La synchronisation Trello ne marche pas

1. Vérifiez que le webhook est actif : `/trello-webhook-setup`
2. Sur Railway, vérifiez que `WEBHOOK_URL` est correct
3. Testez la config : `/trello-config`

### Je ne reçois plus de rappels

1. Vérifiez que vous pouvez recevoir des messages privés du bot
2. Paramètres Discord → Confidentialité → Autorisez les DM

---

## 🎉 Profitez de votre bot !

Vous avez maintenant un assistant personnel 24/7 qui :
- Ne rate jamais un rappel
- Synchronise Trello automatiquement
- S'adapte à votre workflow
- Fonctionne même quand votre ordinateur est éteint

**Pour toute question, consultez les fichiers README.md et GUIDE_TRELLO_WEBHOOK.md**

---

Créé avec ❤️ et Claude Code
