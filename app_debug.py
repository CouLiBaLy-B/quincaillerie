import os
import sys
import traceback
from flask import (
    Flask,
    render_template,
    request,
    jsonify,
    make_response,
    flash,
    redirect,
    url_for,
    session,
)
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import or_, func, and_
import pandas as pd
from datetime import datetime, timedelta, timezone
from fpdf import FPDF
import json
from werkzeug.security import generate_password_hash, check_password_hash

# Configuration de base
app = Flask(__name__)
app.secret_key = "super_secret_key_for_your_hardware_store_v2"
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///quincaillerie_v2.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

print("🔧 Configuration Flask initialisée")

try:
    db = SQLAlchemy(app)
    print("✅ SQLAlchemy initialisé")
except Exception as e:
    print(f"❌ Erreur SQLAlchemy: {e}")
    sys.exit(1)


# Modèles de base (version simplifiée pour test)
class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False, unique=True)
    category = db.Column(db.String(100), nullable=False)
    stock_quantity = db.Column(db.Integer, nullable=False)
    min_price = db.Column(db.Float, nullable=False)
    reorder_level = db.Column(db.Integer, default=10)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "category": self.category,
            "stock_quantity": self.stock_quantity,
            "min_price": self.min_price,
            "reorder_level": self.reorder_level,
            "low_stock": self.stock_quantity <= self.reorder_level,
        }


print("✅ Modèles définis")


# Route de test simple
@app.route("/")
def index():
    try:
        low_stock_products = Product.query.filter(
            Product.stock_quantity <= Product.reorder_level
        ).count()
        print(f"📊 Produits en stock faible: {low_stock_products}")
        return render_template("index.html", low_stock_count=low_stock_products)
    except Exception as e:
        print(f"❌ Erreur dans la route index: {e}")
        return f"Erreur: {e}", 500


@app.route("/test")
def test():
    return jsonify({"status": "OK", "message": "Application fonctionne!"})


print("✅ Routes définies")

if __name__ == "__main__":
    try:
        # Vérifier si la base de données existe
        if not os.path.exists("quincaillerie_v2.db"):
            print("🔨 Création de la base de données...")
            with app.app_context():
                db.create_all()
                print("✅ Base de données créée")

                # Ajouter quelques données de test
                if Product.query.count() == 0:
                    test_products = [
                        Product(
                            name="Marteau",
                            category="Outil",
                            stock_quantity=10,
                            min_price=15.99,
                        ),
                        Product(
                            name="Tournevis",
                            category="Outil",
                            stock_quantity=5,
                            min_price=8.50,
                        ),
                        Product(
                            name="Clous",
                            category="Quincaillerie",
                            stock_quantity=100,
                            min_price=3.20,
                        ),
                    ]
                    for product in test_products:
                        db.session.add(product)
                    db.session.commit()
                    print("✅ Données de test ajoutées")

        print("🚀 Démarrage du serveur Flask...")
        print("📱 Application accessible sur: http://localhost:5000")
        print("🧪 Page de test: http://localhost:5000/test")
        print("🛑 Appuyez sur Ctrl+C pour arrêter")

        app.run(
            debug=True,
            host="0.0.0.0",
            port=5000,
            threaded=True,
            use_reloader=False,  # Évite les problèmes de double démarrage
        )

    except Exception as e:
        print(f"❌ Erreur lors du démarrage: {e}")
        print("📋 Traceback complet:")
        traceback.print_exc()
    except KeyboardInterrupt:
        print("\n👋 Arrêt de l'application")
