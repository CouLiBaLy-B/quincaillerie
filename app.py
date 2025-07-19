from flask import (
    Flask,
    render_template,
    request,
    jsonify,
    make_response,
    flash,
    redirect,
    url_for,
)
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import or_, func
import pandas as pd
from datetime import datetime, timedelta
from fpdf import FPDF
import os

app = Flask(__name__)
app.secret_key = "super_secret_key_for_your_hardware_store"
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///quincaillerie.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)

# --- Database Models ---


class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False, unique=True)
    category = db.Column(db.String(100), nullable=False)
    stock_quantity = db.Column(db.Integer, nullable=False)
    min_price = db.Column(db.Float, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "category": self.category,
            "stock_quantity": self.stock_quantity,
            "min_price": self.min_price,
        }


class Sale(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    sale_date = db.Column(db.DateTime, server_default=db.func.now())
    total_amount = db.Column(db.Float, nullable=False)


class SaleItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    sale_id = db.Column(db.Integer, db.ForeignKey("sale.id"), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey("product.id"), nullable=False)
    quantity_sold = db.Column(db.Integer, nullable=False)
    unit_price = db.Column(db.Float, nullable=False)
    product = db.relationship("Product", backref=db.backref("sale_items", lazy=True))
    sale = db.relationship("Sale", backref=db.backref("items", lazy=True))


# --- Main Routes ---


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/inventory")
def inventory():
    products = Product.query.order_by(Product.name).all()
    return render_template("inventory.html", products=products)


@app.route("/dashboard")
def dashboard():
    today = datetime.utcnow().date()
    start_of_week = today - timedelta(days=today.weekday())
    start_of_month = today.replace(day=1)

    daily_revenue = (
        db.session.query(func.sum(Sale.total_amount))
        .filter(func.date(Sale.sale_date) == today)
        .scalar()
        or 0
    )
    weekly_revenue = (
        db.session.query(func.sum(Sale.total_amount))
        .filter(Sale.sale_date >= start_of_week)
        .scalar()
        or 0
    )
    monthly_revenue = (
        db.session.query(func.sum(Sale.total_amount))
        .filter(Sale.sale_date >= start_of_month)
        .scalar()
        or 0
    )

    top_products = (
        db.session.query(
            Product.name, func.sum(SaleItem.quantity_sold).label("total_sold")
        )
        .join(SaleItem)
        .group_by(Product.name)
        .order_by(func.sum(SaleItem.quantity_sold).desc())
        .limit(10)
        .all()
    )

    sales_by_category = (
        db.session.query(
            Product.category,
            func.sum(SaleItem.quantity_sold * SaleItem.unit_price).label(
                "category_revenue"
            ),
        )
        .join(SaleItem)
        .group_by(Product.category)
        .all()
    )

    return render_template(
        "dashboard.html",
        daily_revenue=daily_revenue,
        weekly_revenue=weekly_revenue,
        monthly_revenue=monthly_revenue,
        top_products=top_products,
        sales_by_category=sales_by_category,
    )


@app.route("/sales-history")
def sales_history():
    sales = Sale.query.order_by(Sale.sale_date.desc()).all()
    return render_template("sales_history.html", sales=sales)


# --- API and Form Handling Routes ---


@app.route("/search", methods=["POST"])
def search():
    data = request.get_json()
    query = data["query"]
    search_term = f"%{query}%"
    products = (
        Product.query.filter(
            or_(Product.name.ilike(search_term), Product.category.ilike(search_term))
        )
        .limit(10)
        .all()
    )
    return jsonify([product.to_dict() for product in products])


@app.route("/product/<int:product_id>")
def get_product(product_id):
    product = Product.query.get_or_404(product_id)
    return jsonify(product.to_dict())


@app.route("/sale", methods=["POST"])
def process_sale():
    data = request.get_json()
    cart = data["cart"]
    total_amount = sum(item["quantity"] * item["price"] for item in cart)

    try:
        new_sale = Sale(total_amount=total_amount)
        db.session.add(new_sale)
        db.session.flush()

        for item in cart:
            product = Product.query.get(item["id"])
            if product.stock_quantity < item["quantity"]:
                db.session.rollback()
                return jsonify({"error": f"Stock insuffisant pour {product.name}"}), 400

            product.stock_quantity -= item["quantity"]
            sale_item = SaleItem(
                sale_id=new_sale.id,
                product_id=item["id"],
                quantity_sold=item["quantity"],
                unit_price=item["price"],
            )
            db.session.add(sale_item)

        db.session.commit()
        return jsonify(
            {"message": "Vente enregistrée avec succès !", "sale_id": new_sale.id}
        )
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route("/receipt/<int:sale_id>")
def generate_receipt(sale_id):
    sale = Sale.query.get_or_404(sale_id)
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", size=12)
    pdf.cell(200, 10, txt="Recu de Vente", ln=True, align="C")
    pdf.cell(
        200, 10, txt=f"Date: {sale.sale_date.strftime('%d/%m/%Y %H:%M:%S')}", ln=True
    )
    pdf.cell(200, 10, txt=f"Numero de vente: {sale.id}", ln=True)
    pdf.ln(10)
    pdf.cell(80, 10, "Produit", 1)
    pdf.cell(30, 10, "Quantite", 1)
    pdf.cell(40, 10, "Prix Unitaire", 1)
    pdf.cell(40, 10, "Total", 1)
    pdf.ln()
    for item in sale.items:
        # Handling potential encoding issues with product names
        product_name = item.product.name.encode("latin-1", "replace").decode("latin-1")
        pdf.cell(80, 10, product_name, 1)
        pdf.cell(30, 10, str(item.quantity_sold), 1)
        pdf.cell(40, 10, f"{item.unit_price:.2f} EUR", 1)
        pdf.cell(40, 10, f"{(item.quantity_sold * item.unit_price):.2f} EUR", 1)
        pdf.ln()
    pdf.ln(10)
    pdf.cell(
        200,
        10,
        txt=f"Total de la vente: {sale.total_amount:.2f} EUR",
        ln=True,
        align="R",
    )
    response = make_response(pdf.output(dest="S").encode("latin-1"))
    response.headers.set(
        "Content-Disposition", "inline", filename=f"recu_{sale_id}.pdf"
    )
    response.headers.set("Content-Type", "application/pdf")
    return response


@app.route("/product/add", methods=["POST"])
def add_product():
    name = request.form["name"]
    category = request.form["category"]
    stock_quantity = int(request.form["stock_quantity"])
    min_price = float(request.form["min_price"])

    if not Product.query.filter_by(name=name).first():
        new_product = Product(
            name=name,
            category=category,
            stock_quantity=stock_quantity,
            min_price=min_price,
        )
        db.session.add(new_product)
        db.session.commit()
        flash("Produit ajouté avec succès!", "success")
    else:
        flash("Un produit avec ce nom existe déjà.", "danger")
    return redirect(url_for("inventory"))


@app.route("/product/edit/<int:product_id>", methods=["POST"])
def edit_product(product_id):
    product = Product.query.get_or_404(product_id)
    product.name = request.form["name"]
    product.category = request.form["category"]
    product.stock_quantity = int(request.form["stock_quantity"])
    product.min_price = float(request.form["min_price"])
    db.session.commit()
    flash("Produit mis à jour avec succès!", "success")
    return redirect(url_for("inventory"))


@app.route("/inventory/import", methods=["POST"])
def import_inventory():
    if "file" not in request.files:
        flash("Aucun fichier sélectionné", "danger")
        return redirect(url_for("inventory"))
    file = request.files["file"]
    if file and file.filename.endswith(".xlsx"):
        try:
            df = pd.read_excel(file)
            for _, row in df.iterrows():
                product = Product.query.filter_by(name=row["nom du produit"]).first()
                if product:
                    product.category = row["catégorie"]
                    product.stock_quantity += row["quantité en stock"]
                    product.min_price = row["prix minimum"]
                else:
                    new_product = Product(
                        name=row["nom du produit"],
                        category=row["catégorie"],
                        stock_quantity=row["quantité en stock"],
                        min_price=row["prix minimum"],
                    )
                    db.session.add(new_product)
            db.session.commit()
            flash("Inventaire importé avec succès!", "success")
        except Exception as e:
            flash(f"Une erreur est survenue: {e}", "danger")
    else:
        flash("Veuillez sélectionner un fichier Excel (.xlsx)", "danger")
    return redirect(url_for("inventory"))


# --- CLI Commands ---


@app.cli.command("init-db")
def init_db_command():
    """Creates the database tables."""
    db.create_all()
    print("Base de données initialisée.")


@app.cli.command("import-excel")
def import_excel_command():
    """Imports data from a sample Excel file."""
    try:
        if not os.path.exists("sample_data.xlsx"):
            data = {
                "nom du produit": [
                    "Marteau",
                    "Tournevis",
                    "Clous (boîte de 100)",
                    "Vis (boîte de 100)",
                    "Scie",
                    "Perceuse",
                ],
                "catégorie": [
                    "Outil à main",
                    "Outil à main",
                    "Quincaillerie",
                    "Quincaillerie",
                    "Outil à main",
                    "Outil électrique",
                ],
                "quantité en stock": [50, 75, 200, 250, 30, 20],
                "prix minimum": [10.00, 5.50, 3.00, 4.00, 15.00, 75.00],
            }
            pd.DataFrame(data).to_excel("sample_data.xlsx", index=False)
            print("Fichier d'exemple 'sample_data.xlsx' créé.")

        df = pd.read_excel("sample_data.xlsx")
        for _, row in df.iterrows():
            if not Product.query.filter_by(name=row["nom du produit"]).first():
                product = Product(
                    name=row["nom du produit"],
                    category=row["catégorie"],
                    stock_quantity=row["quantité en stock"],
                    min_price=row["prix minimum"],
                )
                db.session.add(product)
        db.session.commit()
        print("Données importées avec succès depuis 'sample_data.xlsx'.")
    except Exception as e:
        print(f"Une erreur est survenue: {e}")


if __name__ == "__main__":
    if not os.path.exists("quincaillerie.db"):
        with app.app_context():
            db.create_all()
            print("Base de données créée.")
            import_excel_command()
    app.run(debug=True)
