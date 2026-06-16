# COFINANCE CI — Plateforme Digitale de Microfinance

> Société ivoirienne de microfinance agréée BCEAO — Abidjan, 2026.  
> Backend Django REST API + Frontend HTML/CSS/JS complet — microcrédits, assurances, chat temps réel.

---

## Prérequis

| Outil | Version |
|-------|---------|
| Python | 3.11+ |
| pip | récent |
| SQLite | inclus avec Python (développement) |
| PostgreSQL | 14+ (production) |
| Redis | optionnel — WebSocket production |

---

## Installation rapide

```bash
# 1. Cloner le dépôt
git clone <url-du-repo>
cd cofinanceci

# 2. Environnement virtuel
python -m venv venv

# Windows
venv\Scripts\activate
# Linux / macOS
source venv/bin/activate

# 3. Dépendances
pip install -r requirements.txt

# 4. Configuration
cp .env.example .env   # puis éditez .env si besoin

# 5. Base de données
cd cofci
python manage.py migrate

# 6. Données de démonstration
python manage.py seed_db

# 7. Lancer le serveur (WebSocket inclus grâce à Daphne)
python manage.py runserver
```

---

## Accès à la plateforme

| Service | URL |
|---------|-----|
| **Interface Web** | http://127.0.0.1:8000/app/ |
| **Connexion** | http://127.0.0.1:8000/app/login.html |
| **Swagger UI** | http://127.0.0.1:8000/api/docs/ |
| **ReDoc** | http://127.0.0.1:8000/api/schema/redoc/ |
| **Admin Django** | http://127.0.0.1:8000/admin/ |

---

## Comptes de démonstration

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| **Admin** | admin@cofci.ci | Admin1234! |
| **Agent** | agent1@cofci.ci | Agent1234! |
| **Client** | client1@cofci.ci | Client1234! |
| **Client** | amani.kouassi@gmail.com | Client1234! |

---

## Structure des rôles

| Rôle | Accès |
|------|-------|
| **CLIENT** | Dashboard, soumettre un crédit, consulter l'échéancier, souscrire une assurance, chat support, profil |
| **AGENT** | Traiter les crédits (Kanban drag & drop), enregistrer les paiements, répondre au chat, voir les clients |
| **ADMIN** | Tout ce que fait l'agent + dashboard KPIs, gérer clients (suspendre/activer), créer/modifier/supprimer les produits d'assurance, résilier des polices, assigner des agents |

---

## Modules API

| Module | Préfixe | Fonctionnalités |
|--------|---------|-----------------|
| Auth & Profils | `/api/auth/` | Inscription, connexion, refresh JWT, profil, gestion clients/agents admin |
| Microcrédits | `/api/credits/` | CRUD, workflow statuts, score éligibilité, taux & durée personnalisables, génération échéancier |
| Remboursements | `/api/repayments/` | Enregistrement paiements, historique client, liste retards (AGENT/ADMIN) |
| Assurance | `/api/insurance/` | Catalogue produits, souscription client, polices actives/expirées, résiliation admin |
| Dashboard | `/api/dashboard/stats/` | KPIs admin (total crédits, montants, taux approbation — filtres date/agent/région) |
| Notifications | `/api/notifications/` | Alertes in-app automatiques (signaux Django), marquage lu/non-lu |
| Chat | `/api/chat/` + `ws/chat/{id}/` | Conversations REST + messages WebSocket temps réel, indicateur de frappe |

---

## Chat en temps réel

Le chat utilise **WebSocket** via Django Channels + Daphne.  
`'daphne'` est en premier dans `INSTALLED_APPS` → `runserver` gère les WebSockets automatiquement sans configuration supplémentaire.

```bash
# Connexion WebSocket (authentification par token JWT en query param)
ws://127.0.0.1:8000/ws/chat/<conversation_id>/?token=<ACCESS_TOKEN>
```

L'interface chat (http://127.0.0.1:8000/app/chat.html) gère la connexion WS automatiquement à l'ouverture d'une conversation.

> **Production (Redis) :** `daphne -b 0.0.0.0 -p 8000 cofci.asgi:application`

---

## Commandes utiles

```bash
# Depuis cofci/
python manage.py seed_db           # Peuple la BDD (20 clients ivoiriens, agents, crédits, assurances)
python manage.py check_echeances   # Alertes J-3 avant échéance / retards J+1 / assurance J-15
python manage.py migrate           # Applique les migrations
python manage.py createsuperuser   # Créer un superutilisateur Django admin
```

---

## Configuration production (PostgreSQL + Redis)

Dans `.env` :

```env
DEBUG=False
DJANGO_SECRET_KEY=votre-cle-secrete-longue-et-aleatoire
DATABASE_ENGINE=django.db.backends.postgresql
DATABASE_NAME=bd_cofinance_ci
DATABASE_USER=cofinanceci
DATABASE_PASSWORD=votre_mot_de_passe
DATABASE_HOST=127.0.0.1
DATABASE_PORT=5432
REDIS_URL=redis://127.0.0.1:6379/0
ALLOWED_HOSTS=votre-domaine.ci,www.votre-domaine.ci
```

---

## Structure du projet

```
cofinanceci/
├── requirements.txt
├── .env.example
├── README.md
├── frontend/                      # Interface HTML/CSS/JS — 18 pages
│   ├── index.html                 # Landing page publique
│   ├── login.html                 # Connexion
│   ├── register.html              # Inscription client
│   ├── client-dashboard.html      # Tableau de bord client
│   ├── credits.html               # Liste des crédits (client/agent/admin)
│   ├── credit-request.html        # Formulaire de demande de crédit
│   ├── repayments.html            # Échéancier & remboursements
│   ├── insurance.html             # Catalogue assurances + mes polices
│   ├── notifications.html         # Notifications in-app
│   ├── chat.html                  # Support chat (WebSocket)
│   ├── profile.html               # Profil utilisateur (tous rôles)
│   ├── admin-dashboard.html       # KPIs & statistiques admin
│   ├── admin-clients.html         # Gestion clients (suspendre/activer)
│   ├── admin-agents.html          # Gestion agents
│   ├── admin-credits.html         # Kanban crédits (drag & drop)
│   ├── admin-insurances.html      # Produits & polices d'assurance
│   ├── admin-support.html         # Support conversations (agent/admin)
│   └── assets/
│       ├── css/style.css          # Design System "Côte Bleue" (navy/bleu/or)
│       └── js/app.js              # Logique SPA — Auth, Http, pages
└── cofci/                         # Projet Django
    ├── manage.py
    ├── cofci/                     # settings.py, urls.py, asgi.py
    ├── account/                   # Auth JWT, profils, seed_db, admin clients
    ├── credit/                    # Modèles, views, CreditService, migrations
    ├── repayements/               # Paiements, historique, check_echeances
    ├── insurance/                 # Produits, polices, souscription
    ├── dashboard/                 # Stats KPIs admin
    ├── notification/              # Alertes + signaux automatiques
    ├── chat/                      # ChatConsumer WS, serializers, JWT middleware
    └── base/                      # Permissions custom, exceptions globales
```

---

## Stack technique

| Composant | Technologie |
|-----------|-------------|
| Backend | Django 5.1.4 + Django REST Framework 3.15 |
| WebSocket | Django Channels 4.1.0 + Daphne |
| Authentification | JWT via djangorestframework-simplejwt |
| Documentation API | drf-spectacular (Swagger UI + ReDoc) |
| Base de données | SQLite (développement) / PostgreSQL (production) |
| Cache / Channel Layer | InMemoryChannelLayer (dev) / Redis (prod) |
| Frontend | HTML5 + CSS3 Variables + JavaScript Vanilla (SPA) |
| Design System | "Côte Bleue" — Navy `#070E1D`, Bleu `#1D4ED8`, Or `#B45309` |

---

## Modèles de données clés

| Modèle | Champs notables |
|--------|-----------------|
| `CustomUser` | `role` (CLIENT/AGENT/ADMIN), `is_active`, coordonnées ivoiriennes |
| `CreditRequest` | `montant_demande`, `duree_mois`, `taux_interet` (% annuel), `motif`, `statut` |
| `RepaymentSchedule` | `numero_echeance`, `date_echeance`, `montant_du`, `statut` (EN_ATTENTE/PAYEE/EN_RETARD) |
| `InsuranceProduct` | `nom`, `type_produit` (VIE/DECES_INVALIDITE), `prime_mensuelle`, `couverture_max` |
| `InsurancePolicy` | `client`, `produit`, `date_debut`, `date_fin`, `statut` |
| `Conversation` | `client`, `agent`, `statut` (EN_COURS/FERMEE) |
| `Message` | `conversation`, `auteur`, `contenu`, `lu`, `timestamp` |
| `Notification` | `destinataire`, `message`, `lu`, créées automatiquement par signaux Django |



REALISÉE PAR ELIE EHOUSSOU 