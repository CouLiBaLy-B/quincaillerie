# 🔧 Système de Gestion de Quincaillerie - POS Complet

Un système de point de vente (POS) moderne et complet pour la gestion d'une quincaillerie, développé avec Flask et une interface web responsive.

## 🚀 Fonctionnalités

### 📦 Gestion d'Inventaire
- ✅ Ajout, modification et suppression de produits
- ✅ Gestion des catégories et fournisseurs
- ✅ Alertes de stock faible automatiques
- ✅ Codes-barres et recherche avancée
- ✅ Import/Export Excel
- ✅ Niveaux de réapprovisionnement

### 🛒 Point de Vente (POS)
- ✅ Interface de vente intuitive
- ✅ Recherche produits en temps réel
- ✅ Gestion du panier avec calculs automatiques
- ✅ Support des remises et promotions
- ✅ Multiples modes de paiement
- ✅ Génération de reçus PDF
- ✅ Raccourcis clavier

### 👥 Gestion Clients
- ✅ Base de données clients complète
- ✅ Historique des achats
- ✅ Statistiques de fidélité
- ✅ Recherche et sélection rapide

### 🏪 Gestion Fournisseurs
- ✅ Informations détaillées des fournisseurs
- ✅ Association produits-fournisseurs
- ✅ Contacts et coordonnées

### 🎯 Promotions
- ✅ Création de promotions flexibles
- ✅ Remises par catégorie ou quantité
- ✅ Dates de validité
- ✅ Application automatique

### 📊 Tableau de Bord & Rapports
- ✅ Statistiques en temps réel
- ✅ Revenus quotidiens/hebdomadaires/mensuels
- ✅ Produits les plus vendus
- ✅ Analyse par catégorie
- ✅ Historique des ventes
- ✅ Rapports exportables

## 🛠️ Technologies Utilisées

### Backend
- **Flask** - Framework web Python
- **SQLAlchemy** - ORM pour base de données
- **SQLite** - Base de données légère
- **Pandas** - Manipulation de données Excel
- **FPDF** - Génération de PDF

### Frontend
- **Bootstrap 4** - Framework CSS responsive
- **jQuery** - Manipulation DOM et AJAX
- **Font Awesome** - Icônes
- **CSS3** - Animations et styles personnalisés

## 📋 Prérequis

- Python 3.8+
- pip (gestionnaire de paquets Python)

## 🚀 Installation

### 1. Cloner le repository
```bash
git clone https://github.com/CouLiBaLy-B/quincaillerie.git
cd quincaillerie
```

### 2. Créer un environnement virtuel
```bash
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate
```

### 3. Installer les dépendances
```bash
pip install -r requirements.txt
```

### 4. Initialiser la base de données
```bash
# Méthode 1: Automatique au premier lancement
python app_v3.py

# Méthode 2: Manuel avec CLI
flask --app app_v3 init-db
flask --app app_v3 seed-data
```

## 🎯 Utilisation

### Démarrage de l'application
```bash
python app_v3.py
```

L'application sera accessible sur : `http://localhost:5000`

### Comptes par défaut
Aucun système d'authentification n'est implémenté par défaut. L'accès est libre.

### Données d'exemple
Au premier lancement, l'application génère automatiquement :
- 6+ produits d'exemple
- 3 fournisseurs
- 3 clients
- 1 promotion active

## 📁 Structure du Projet

```
quincaillerie/
├── app_v3.py                 # Application principale (version complète)
├── app_v2.py                 # Version intermédiaire
├── app.py                    # Version basique
├── requirements.txt          # Dépendances Python
├── README.md                # Documentation
├── quincaillerie_v2.db      # Base de données SQLite
├── templates/               # Templates HTML
│   ├── index.html          # Page d'accueil/POS
│   ├── inventory.html      # Gestion inventaire
│   ├── dashboard.html      # Tableau de bord
│   ├── customers.html      # Gestion clients
│   ├── suppliers.html      # Gestion fournisseurs
│   ├── promotions.html     # Gestion promotions
│   ├── reports.html        # Rapports
│   └── sales_history.html  # Historique ventes
├── static/                 # Fichiers statiques
│   ├── css/
│   │   └── style.css      # Styles personnalisés
│   └── js/
│       └── main.js        # JavaScript principal
└── venv/                  # Environnement virtuel
```

## 🔧 Configuration

### Variables d'environnement (optionnel)
```bash
export FLASK_ENV=development
export FLASK_DEBUG=1
export SECRET_KEY=your-secret-key-here
```

### Base de données
Par défaut, SQLite est utilisé. Pour changer :
```python
# Dans app_v3.py
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://user:pass@localhost/dbname'
```

## 📱 Interface Utilisateur

### Page d'Accueil - POS
- Recherche de produits en temps réel
- Sélection et ajout au panier
- Gestion des clients
- Calcul automatique des totaux et taxes
- Finalisation des ventes

### Gestion d'Inventaire
- Liste complète des produits
- Filtres par catégorie et stock
- Ajout/modification/suppression
- Gestion des fournisseurs

### Tableau de Bord
- Statistiques de vente en temps réel
- Graphiques et métriques
- Alertes de stock faible
- Résumé des performances

## 🔌 API Endpoints

### Produits
- `POST /search` - Recherche de produits
- `GET /product/<id>` - Détails d'un produit
- `POST /product/add` - Ajouter un produit
- `POST /product/edit/<id>` - Modifier un produit

### Ventes
- `POST /sale` - Enregistrer une vente
- `GET /receipt/<id>` - Générer un reçu PDF

### Clients
- `POST /api/customers/search` - Recherche de clients
- `POST /customer/add` - Ajouter un client

### Promotions
- `POST /api/promotions/check` - Vérifier les promotions applicables

### Statistiques
- `GET /api/dashboard-stats` - Statistiques du tableau de bord
- `GET /api/low-stock-alerts` - Alertes de stock faible

## 🎨 Personnalisation

### Thème et Couleurs
Modifiez `static/css/style.css` pour personnaliser l'apparence :
```css
:root {
    --primary-color: #007bff;
    --success-color: #28a745;
    --warning-color: #ffc107;
    --danger-color: #dc3545;
}
```

### Logo et Branding
Remplacez le nom dans `templates/index.html` :
```html
<a class="navbar-brand" href="/">
    <i class="fas fa-tools"></i> Votre Nom de Magasin
</a>
```

## 🔒 Sécurité

### Recommandations pour la production
1. **Changer la clé secrète** :
```python
app.secret_key = 'your-very-secure-secret-key'
```

2. **Utiliser HTTPS** :
```python
app.run(ssl_context='adhoc')
```

3. **Ajouter l'authentification** :
```python
from flask_login import LoginManager
```

4. **Sauvegardes régulières** de la base de données

## 📊 Fonctionnalités Avancées

### Import/Export Excel
```python
# Import automatique au démarrage
flask --app app_v3 import-excel

# Export via l'interface web
/inventory -> Bouton Export
```

### Codes-barres
- Saisie manuelle dans la recherche
- Bouton scan (simulation)
- Détection automatique de frappe rapide

### Raccourcis Clavier
- `Ctrl + Enter` : Finaliser la vente
- `Escape` : Annuler la sélection
- `F1` : Focus recherche produits
- `F2` : Focus recherche clients

### Sauvegarde Automatique
Le panier est automatiquement sauvegardé dans le navigateur.

## 🐛 Dépannage

### Erreurs Communes

1. **Base de données verrouillée** :
```bash
rm quincaillerie_v2.db
python app_v3.py
```

2. **Port déjà utilisé** :
```python
app.run(port=5001)  # Changer le port
```

3. **Modules manquants** :
```bash
pip install -r requirements.txt
```

### Logs et Debug
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

## 🤝 Contribution

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/AmazingFeature`)
3. Commit les changements (`git commit -m 'Add AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 📝 Changelog

### Version 3.0 (Actuelle)
- ✅ Interface POS complète
- ✅ Gestion des promotions
- ✅ Système de clients avancé
- ✅ Rapports et statistiques
- ✅ Import/Export Excel
- ✅ Interface responsive

### Version 2.0
- ✅ Gestion des fournisseurs
- ✅ Codes-barres
- ✅ Niveaux de stock
- ✅ Historique des ventes

### Version 1.0
- ✅ Fonctionnalités de base POS
- ✅ Gestion d'inventaire simple
- ✅ Génération de reçus

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

## 👨‍💻 Auteur

**CouLiBaLy-B**
- GitHub: [@CouLiBaLy-B](https://github.com/CouLiBaLy-B)

## 🙏 Remerciements

- Flask et la communauté Python
- Bootstrap pour l'interface utilisateur
- Font Awesome pour les icônes
- Tous les contributeurs du projet

## 📞 Support

Pour toute question ou problème :
1. Ouvrir une [issue](https://github.com/CouLiBaLy-B/quincaillerie/issues)
2. Consulter la documentation
3. Vérifier les logs d'erreur

---

⭐ **N'oubliez pas de donner une étoile au projet si vous le trouvez utile !**