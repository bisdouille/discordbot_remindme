# Guide d'utilisation - Système de Tags pour Conversations

## Vue d'ensemble

Le système de tags vous permet d'organiser et de retrouver facilement vos conversations Discord en leur attribuant des tags personnalisés, des noms et des catégories.

## Fonctionnalités principales

### 🏷️ Gestion des tags

#### Créer un tag
```
/tags-creer nom:"Influenceur"
/tags-creer nom:"FR"
/tags-creer nom:"EN"
/tags-creer nom:"Prestataire MC"
```

#### Voir tous les tags disponibles
```
/tags-liste
```

#### Supprimer un tag
```
/tags-supprimer nom:"Influenceur"
```
⚠️ Note : Supprimer un tag le retire automatiquement de toutes les conversations qui l'utilisent.

### 📁 Gestion des catégories

#### Créer une catégorie
```
/categorie-creer nom:"Clients"
/categorie-creer nom:"Partenaires"
/categorie-creer nom:"Prospects"
```

#### Supprimer une catégorie
```
/categorie-supprimer nom:"Clients"
```

## 💬 Taguer des conversations

### Méthode 1 : Clic droit sur un message

1. Faites un clic droit sur n'importe quel message dans une conversation (DM ou serveur)
2. Sélectionnez **"Taguer cette conversation"**
3. Remplissez le formulaire :
   - **Nom** : Le nom de la personne/conversation (ex: "Jean", "Marie")
   - **Tags** : Les tags séparés par des virgules (ex: "Influenceur, FR")
   - **Catégorie** : (Optionnel) La catégorie (ex: "Clients")

### Exemple d'utilisation

Vous parlez à Jean en DM, qui est un influenceur français :

1. Clic droit sur un message de Jean
2. "Taguer cette conversation"
3. Remplissez :
   - Nom : `Jean`
   - Tags : `Influenceur, FR`
   - Catégorie : `Clients`

### Modification automatique des doublons

Si vous taguez à nouveau une conversation déjà taguée, le système détecte automatiquement le doublon et **met à jour** l'entrée existante au lieu d'en créer une nouvelle.

## 🔍 Consulter vos conversations taguées

### Voir toutes les conversations
```
/conversations-taguees
```

Affiche toutes vos conversations taguées, groupées par catégorie.

### Filtrer par catégorie
```
/conversations-taguees categorie:"Clients"
```

### Filtrer par tag spécifique
```
/conversations-par-tag tag:"Influenceur"
```

Affiche uniquement les conversations ayant ce tag.

## ✏️ Modifier une conversation

```
/conversation-modifier nom:"Jean"
```

Ouvre un formulaire pour modifier le nom, les tags et la catégorie de la conversation.

## 🗑️ Supprimer une conversation des tags

```
/conversation-supprimer nom:"Jean"
```

Retire complètement la conversation de votre système de tags.

## Exemples de cas d'usage

### Cas 1 : Organiser vos influenceurs

1. Créer les tags nécessaires :
   ```
   /tags-creer nom:"Influenceur"
   /tags-creer nom:"FR"
   /tags-creer nom:"EN"
   /tags-creer nom:"Gaming"
   /tags-creer nom:"Tech"
   ```

2. Créer une catégorie :
   ```
   /categorie-creer nom:"Influenceurs"
   ```

3. Taguer vos conversations :
   - Jean (influenceur français gaming) : Tags `Influenceur, FR, Gaming` - Catégorie `Influenceurs`
   - Sarah (influenceuse anglaise tech) : Tags `Influenceur, EN, Tech` - Catégorie `Influenceurs`

4. Retrouver facilement :
   ```
   /conversations-par-tag tag:"Gaming"  # Tous les influenceurs gaming
   /conversations-taguees categorie:"Influenceurs"  # Tous les influenceurs
   ```

### Cas 2 : Gérer vos prestataires

1. Créer les tags :
   ```
   /tags-creer nom:"Prestataire MC"
   /tags-creer nom:"Graphiste"
   /tags-creer nom:"Développeur"
   ```

2. Créer une catégorie :
   ```
   /categorie-creer nom:"Prestataires"
   ```

3. Taguer :
   - Marc (prestataire MC graphiste) : Tags `Prestataire MC, Graphiste` - Catégorie `Prestataires`
   - Julie (prestataire MC dev) : Tags `Prestataire MC, Développeur` - Catégorie `Prestataires`

4. Retrouver :
   ```
   /conversations-par-tag tag:"Graphiste"  # Tous les graphistes
   /conversations-taguees categorie:"Prestataires"  # Tous les prestataires
   ```

## 📊 Structure des données

### Format d'une conversation taguée
```json
{
  "conversationId": "123456789",
  "ownerId": "987654321",
  "nom": "Jean",
  "tags": ["Influenceur", "FR"],
  "categorie": "Clients",
  "messageLink": "https://discord.com/channels/@me/123456789",
  "createdAt": 1730289600000,
  "updatedAt": 1730289600000
}
```

### Tags par défaut

Le bot est livré avec quelques tags et catégories par défaut :

**Tags :**
- Influenceur
- FR
- EN
- Prestataire MC
- Client
- Partenaire

**Catégories :**
- Clients
- Partenaires
- Prospects
- Équipe

Vous pouvez les modifier/supprimer et en créer de nouveaux selon vos besoins.

## 🔒 Sécurité et confidentialité

- Vos conversations taguées sont stockées localement dans `tagged-conversations.json`
- Chaque utilisateur ne voit que ses propres conversations taguées
- Les données ne sont pas partagées entre utilisateurs
- Pensez à ajouter ces fichiers dans `.gitignore` (déjà fait automatiquement)

## ⚙️ Fichiers créés

- `tagged-conversations.json` : Stockage de vos conversations taguées
- `available-tags.json` : Liste des tags et catégories disponibles

Ces fichiers sont automatiquement créés au premier lancement du bot.

## 💡 Conseils d'utilisation

1. **Créez vos tags avant de taguer** : Bien que vous puissiez entrer n'importe quel tag, il est recommandé de créer vos tags d'abord avec `/tags-creer` pour avoir une liste cohérente.

2. **Utilisez des catégories claires** : Organisez vos conversations en catégories logiques (Clients, Partenaires, etc.) pour faciliter la recherche.

3. **Nommez clairement vos conversations** : Utilisez des noms explicites qui vous permettront de retrouver facilement la personne.

4. **Tags multiples** : N'hésitez pas à utiliser plusieurs tags par conversation pour une meilleure organisation.

5. **Modifiez plutôt que recréer** : Le système détecte les doublons, mais si vous voulez modifier une conversation, utilisez `/conversation-modifier` pour plus de clarté.

## 🆘 Dépannage

### "Aucune conversation taguée"
- Assurez-vous d'avoir tagué au moins une conversation avec le menu contextuel (clic droit)

### "Le tag n'existe pas"
- Vérifiez la liste des tags disponibles avec `/tags-liste`
- Créez le tag avec `/tags-creer` si nécessaire

### "Conversation introuvable"
- Vérifiez le nom exact avec `/conversations-taguees`
- Le nom est sensible à la casse (majuscules/minuscules)

## 🚀 Prochaines améliorations possibles

- Recherche par mots-clés dans les noms de conversations
- Export CSV de vos conversations taguées
- Statistiques sur vos tags les plus utilisés
- Fusion de tags
- Tags hiérarchiques (tags parents/enfants)
