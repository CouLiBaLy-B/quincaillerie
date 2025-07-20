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
from datetime import datetime, timedelta
from fpdf import FPDF
import os
import json
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.secret_key = "super_secret_key_for_your_hardware_store_v2"
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///quincaillerie_v2.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)

# --- Database Models ---


class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False, unique=True)
    category = db.Column(db.String(100), nullable=False)
    stock_quantity = db.Column(db.Integer, nullable=False)
    min_price = db.Column(db.Float, nullable=False)
    reorder_level = db.Column(db.Integer, default=10)
    supplier_id = db.Column(db.Integer, db.ForeignKey("supplier.id"))
    barcode = db.Column(db.String(50), unique=True)
    description = db.Column(db.Text)
    image_url = db.Column(db.String(200))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    supplier = db.relationship("Supplier", backref="products")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "category": self.category,
            "stock_quantity": self.stock_quantity,
            "min_price": self.min_price,
            "reorder_level": self.reorder_level,
            "barcode": self.barcode,
            "description": self.description,
            "image_url": self.image_url,
            "supplier": self.supplier.name if self.supplier else None,
            "low_stock": self.stock_quantity <= self.reorder_level,
        }


class Customer(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True)
    phone = db.Column(db.String(20))
    address = db.Column(db.Text)
    total_spent = db.Column(db.Float, default=0.0)
    visits = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_visit = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "phone": self.phone,
            "address": self.address,
            "total_spent": self.total_spent,
            "visits": self.visits,
            "last_visit": self.last_visit.isoformat() if self.last_visit else None,
        }


class Supplier(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    contact_person = db.Column(db.String(100))
    email = db.Column(db.String(120))
    phone = db.Column(db.String(20))
    address = db.Column(db.Text)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "contact_person": self.contact_person,
            "email": self.email,
            "phone": self.phone,
            "address": self.address,
        }


class Sale(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    sale_date = db.Column(db.DateTime, server_default=db.func.now())
    total_amount = db.Column(db.Float, nullable=False)
    discount_amount = db.Column(db.Float, default=0.0)
    tax_amount = db.Column(db.Float, default=0.0)
    customer_id = db.Column(db.Integer, db.ForeignKey("customer.id"))
    payment_method = db.Column(db.String(50), default="Cash")
    notes = db.Column(db.Text)

    customer = db.relationship("Customer", backref="sales")


class SaleItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    sale_id = db.Column(db.Integer, db.ForeignKey("sale.id"), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey("product.id"), nullable=False)
    quantity_sold = db.Column(db.Integer, nullable=False)
    unit_price = db.Column(db.Float, nullable=False)
    discount_percent = db.Column(db.Float, default=0.0)

    product = db.relationship("Product", backref=db.backref("sale_items", lazy=True))
    sale = db.relationship("Sale", backref=db.backref("items", lazy=True))


class Promotion(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    discount_percent = db.Column(db.Float, nullable=False)
    start_date = db.Column(db.DateTime, nullable=False)
    end_date = db.Column(db.DateTime, nullable=False)
    min_quantity = db.Column(db.Integer, default=1)
    applicable_categories = db.Column(db.String(200))  # JSON string
    active = db.Column(db.Boolean, default=True)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "discount_percent": self.discount_percent,
            "start_date": self.start_date.isoformat(),
            "end_date": self.end_date.isoformat(),
            "min_quantity": self.min_quantity,
            "applicable_categories": json.loads(self.applicable_categories or "[]"),
            "active": self.active,
        }


# --- Main Routes ---


@app.route("/")
def index():
    # Get low stock alerts
    low_stock_products = Product.query.filter(
        Product.stock_quantity <= Product.reorder_level
    ).count()
    return render_template("index.html", low_stock_count=low_stock_products)


@app.route("/inventory")
def inventory():
    search = request.args.get("search", "")
    category = request.args.get("category", "")
    low_stock_only = request.args.get("low_stock", False)

    query = Product.query

    if search:
        query = query.filter(Product.name.ilike(f"%{search}%"))

    if category:
        query = query.filter(Product.category == category)

    if low_stock_only:
        query = query.filter(Product.stock_quantity <= Product.reorder_level)

    products = query.order_by(Product.name).all()
    categories = db.session.query(Product.category).distinct().all()
    suppliers = Supplier.query.all()

    return render_template(
        "inventory.html",
        products=products,
        categories=[c[0] for c in categories],
        suppliers=suppliers,
        search=search,
        selected_category=category,
    )


@app.route("/dashboard")
def dashboard():
    today = datetime.utcnow().date()
    start_of_week = today - timedelta(days=today.weekday())
    start_of_month = today.replace(day=1)

    # Revenue calculations
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

    # Top products
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

    # Sales by category
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

    # Low stock products
    low_stock_products = Product.query.filter(
        Product.stock_quantity <= Product.reorder_level
    ).all()

    # Recent sales
    recent_sales = Sale.query.order_by(Sale.sale_date.desc()).limit(5).all()

    # Customer stats
    total_customers = Customer.query.count()
    active_customers = Customer.query.filter(
        Customer.last_visit >= start_of_month
    ).count()

    return render_template(
        "dashboard.html",
        daily_revenue=daily_revenue,
        weekly_revenue=weekly_revenue,
        monthly_revenue=monthly_revenue,
        top_products=top_products,
        sales_by_category=sales_by_category,
        low_stock_products=low_stock_products,
        recent_sales=recent_sales,
        total_customers=total_customers,
        active_customers=active_customers,
    )


@app.route("/customers")
def customers():
    customers_list = Customer.query.order_by(Customer.total_spent.desc()).all()
    return render_template("customers.html", customers=customers_list)


@app.route("/suppliers")
def suppliers():
    suppliers_list = Supplier.query.order_by(Supplier.name).all()
    return render_template("suppliers.html", suppliers=suppliers_list)


@app.route("/promotions")
def promotions():
    promotions_list = (
        Promotion.query.filter(Promotion.active == True)
        .order_by(Promotion.end_date)
        .all()
    )
    categories = db.session.query(Product.category).distinct().all()
    return render_template(
        "promotions.html",
        promotions=promotions_list,
        categories=[c[0] for c in categories],
    )


@app.route("/reports")
def reports():
    return render_template("reports.html")


@app.route("/sales-history")
def sales_history():
    page = request.args.get("page", 1, type=int)
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")

    query = Sale.query

    if start_date:
        query = query.filter(
            Sale.sale_date >= datetime.strptime(start_date, "%Y-%m-%d")
        )
    if end_date:
        query = query.filter(Sale.sale_date <= datetime.strptime(end_date, "%Y-%m-%d"))

    sales = query.order_by(Sale.sale_date.desc()).paginate(
        page=page, per_page=20, error_out=False
    )

    return render_template(
        "sales_history.html", sales=sales, start_date=start_date, end_date=end_date
    )


# --- API Routes ---


@app.route("/search", methods=["POST"])
def search():
    data = request.get_json()
    query = data["query"]
    search_term = f"%{query}%"
    products = (
        Product.query.filter(
            or_(
                Product.name.ilike(search_term),
                Product.category.ilike(search_term),
                Product.barcode.ilike(search_term),
            )
        )
        .limit(15)
        .all()
    )
    return jsonify([product.to_dict() for product in products])


@app.route("/product/<int:product_id>")
def get_product(product_id):
    product = Product.query.get_or_404(product_id)
    return jsonify(product.to_dict())


@app.route("/api/customers/search", methods=["POST"])
def search_customers():
    data = request.get_json()
    query = data.get("query", "")
    customers = (
        Customer.query.filter(
            or_(
                Customer.name.ilike(f"%{query}%"),
                Customer.phone.ilike(f"%{query}%"),
                Customer.email.ilike(f"%{query}%"),
            )
        )
        .limit(10)
        .all()
    )
    return jsonify([customer.to_dict() for customer in customers])


@app.route("/api/promotions/check", methods=["POST"])
def check_promotions():
    data = request.get_json()
    product_id = data["product_id"]
    quantity = data["quantity"]

    product = Product.query.get(product_id)
    if not product:
        return jsonify({"error": "Product not found"}), 404

    # Check for applicable promotions
    now = datetime.utcnow()
    promotions = Promotion.query.filter(
        and_(
            Promotion.active == True,
            Promotion.start_date <= now,
            Promotion.end_date >= now,
            Promotion.min_quantity <= quantity,
        )
    ).all()

    best_discount = 0
    applicable_promotion = None

    for promo in promotions:
        categories = json.loads(promo.applicable_categories or "[]")
        if not categories or product.category in categories:
            if promo.discount_percent > best_discount:
                best_discount = promo.discount_percent
                applicable_promotion = promo

    return jsonify(
        {
            "discount_percent": best_discount,
            "promotion": (
                applicable_promotion.to_dict() if applicable_promotion else None
            ),
        }
    )


@app.route("/sale", methods=["POST"])
def process_sale():
    data = request.get_json()
    cart = data["cart"]
    customer_id = data.get("customer_id")
    payment_method = data.get("payment_method", "Cash")
    notes = data.get("notes", "")

    total_amount = sum(
        item["quantity"] * item["price"] * (1 - item.get("discount_percent", 0) / 100)
        for item in cart
    )
    discount_amount = sum(
        item["quantity"] * item["price"] * item.get("discount_percent", 0) / 100
        for item in cart
    )
    tax_amount = total_amount * 0.2  # 20% VAT

    try:
        new_sale = Sale(
            total_amount=total_amount + tax_amount,
            discount_amount=discount_amount,
            tax_amount=tax_amount,
            customer_id=customer_id,
            payment_method=payment_method,
            notes=notes,
        )
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
                discount_percent=item.get("discount_percent", 0),
            )
            db.session.add(sale_item)

        # Update customer stats if customer selected
        if customer_id:
            customer = Customer.query.get(customer_id)
            customer.total_spent += total_amount + tax_amount
            customer.visits += 1
            customer.last_visit = datetime.utcnow()

        db.session.commit()
        return jsonify(
            {"message": "Vente enregistrée avec succès !", "sale_id": new_sale.id}
        )
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# --- Management Routes ---


@app.route("/customer/add", methods=["POST"])
def add_customer():
    data = request.get_json() if request.is_json else request.form

    customer = Customer(
        name=data["name"],
        email=data.get("email"),
        phone=data.get("phone"),
        address=data.get("address"),
    )
    db.session.add(customer)
    db.session.commit()

    if request.is_json:
        return jsonify(
            {"message": "Client ajouté avec succès!", "customer": customer.to_dict()}
        )
    else:
        flash("Client ajouté avec succès!", "success")
        return redirect(url_for("customers"))


@app.route("/supplier/add", methods=["POST"])
def add_supplier():
    name = request.form["name"]
    contact_person = request.form.get("contact_person")
    email = request.form.get("email")
    phone = request.form.get("phone")
    address = request.form.get("address")

    supplier = Supplier(
        name=name,
        contact_person=contact_person,
        email=email,
        phone=phone,
        address=address,
    )
    db.session.add(supplier)
    db.session.commit()
    flash("Fournisseur ajouté avec succès!", "success")
    return redirect(url_for("suppliers"))


@app.route("/promotion/add", methods=["POST"])
def add_promotion():
    name = request.form["name"]
    description = request.form.get("description")
    discount_percent = float(request.form["discount_percent"])
    start_date = datetime.strptime(request.form["start_date"], "%Y-%m-%d")
    end_date = datetime.strptime(request.form["end_date"], "%Y-%m-%d")
    min_quantity = int(request.form.get("min_quantity", 1))
    categories = request.form.getlist("categories")

    promotion = Promotion(
        name=name,
        description=description,
        discount_percent=discount_percent,
        start_date=start_date,
        end_date=end_date,
        min_quantity=min_quantity,
        applicable_categories=json.dumps(categories),
    )
    db.session.add(promotion)
    db.session.commit()
    flash("Promotion ajoutée avec succès!", "success")
    return redirect(url_for("promotions"))


@app.route("/product/add", methods=["POST"])
def add_product():
    name = request.form["name"]
    category = request.form["category"]
    stock_quantity = int(request.form["stock_quantity"])
    min_price = float(request.form["min_price"])
    reorder_level = int(request.form.get("reorder_level", 10))
    supplier_id = request.form.get("supplier_id")
    barcode = request.form.get("barcode")
    description = request.form.get("description")

    if not Product.query.filter_by(name=name).first():
        new_product = Product(
            name=name,
            category=category,
            stock_quantity=stock_quantity,
            min_price=min_price,
            reorder_level=reorder_level,
            supplier_id=supplier_id if supplier_id else None,
            barcode=barcode,
            description=description,
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
    product.reorder_level = int(
        request.form.get("reorder_level", product.reorder_level)
    )
    product.supplier_id = (
        request.form.get("supplier_id") if request.form.get("supplier_id") else None
    )
    product.barcode = request.form.get("barcode")
    product.description = request.form.get("description")

    db.session.commit()
    flash("Produit mis à jour avec succès!", "success")
    return redirect(url_for("inventory"))


# --- Receipt Generation ---
@app.route("/receipt/<int:sale_id>")
def generate_receipt(sale_id):
    sale = Sale.query.get_or_404(sale_id)
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", size=12)

    # Header
    pdf.cell(200, 10, txt="QUINCAILLERIE MODERNE", ln=True, align="C")
    pdf.cell(200, 10, txt="Recu de Vente", ln=True, align="C")
    pdf.ln(5)

    # Sale info
    pdf.cell(
        200, 10, txt=f"Date: {sale.sale_date.strftime('%d/%m/%Y %H:%M:%S')}", ln=True
    )
    pdf.cell(200, 10, txt=f"Numero de vente: {sale.id}", ln=True)
    if sale.customer:
        pdf.cell(200, 10, txt=f"Client: {sale.customer.name}", ln=True)
    pdf.cell(200, 10, txt=f"Mode de paiement: {sale.payment_method}", ln=True)
    pdf.ln(5)

    # Items table
    pdf.cell(80, 10, "Produit", 1)
    pdf.cell(20, 10, "Qte", 1)
    pdf.cell(30, 10, "Prix U.", 1)
    pdf.cell(20, 10, "Rem.%", 1)
    pdf.cell(30, 10, "Total", 1)
    pdf.ln()

    for item in sale.items:
        product_name = item.product.name.encode("latin-1", "replace").decode("latin-1")
        pdf.cell(80, 10, product_name, 1)
        pdf.cell(20, 10, str(item.quantity_sold), 1)
        pdf.cell(30, 10, f"{item.unit_price:.2f}", 1)
        pdf.cell(20, 10, f"{item.discount_percent:.0f}%", 1)
        discounted_price = item.unit_price * (1 - item.discount_percent / 100)
        total_item = item.quantity_sold * discounted_price
        pdf.cell(30, 10, f"{total_item:.2f}", 1)
        pdf.ln()

    pdf.ln(5)

    # Totals
    subtotal = sale.total_amount - sale.tax_amount
    pdf.cell(200, 10, txt=f"Sous-total: {subtotal:.2f} EUR", ln=True, align="R")
    if sale.discount_amount > 0:
        pdf.cell(
            200, 10, txt=f"Remise: -{sale.discount_amount:.2f} EUR", ln=True, align="R"
        )
    pdf.cell(200, 10, txt=f"TVA (20%): {sale.tax_amount:.2f} EUR", ln=True, align="R")
    pdf.cell(200, 10, txt=f"TOTAL: {sale.total_amount:.2f} EUR", ln=True, align="R")

    response = make_response(pdf.output(dest="S").encode("latin-1"))
    response.headers.set(
        "Content-Disposition", "inline", filename=f"recu_{sale_id}.pdf"
    )
    response.headers.set("Content-Type", "application/pdf")
    return response


# --- CLI Commands ---


@app.cli.command("init-db")
def init_db_command():
    """Creates the database tables."""
    db.create_all()
    print("Base de données initialisée.")


@app.cli.command("seed-data")
def seed_data_command():
    """Seeds the database with sample data."""

    # Add suppliers
    suppliers_data = [
        {
            "name": "Outillage Pro",
            "contact_person": "Jean Dupont",
            "email": "contact@outillagepro.com",
            "phone": "01.23.45.67.89",
        },
        {
            "name": "Quincaillerie Centrale",
            "contact_person": "Marie Martin",
            "email": "marie@quinc-centrale.fr",
            "phone": "01.98.76.54.32",
        },
        {
            "name": "Électro Supply",
            "contact_person": "Pierre Durand",
            "email": "p.durand@electrosupply.com",
            "phone": "01.11.22.33.44",
        },
    ]

    for supplier_data in suppliers_data:
        if not Supplier.query.filter_by(name=supplier_data["name"]).first():
            supplier = Supplier(**supplier_data)
            db.session.add(supplier)

    db.session.commit()

    # Add sample products with suppliers
    supplier1 = Supplier.query.filter_by(name="Outillage Pro").first()
    supplier2 = Supplier.query.filter_by(name="Quincaillerie Centrale").first()
    supplier3 = Supplier.query.filter_by(name="Électro Supply").first()

    products_data = [
        {
            "name": "Marteau professionnel",
            "category": "Outil à main",
            "stock_quantity": 45,
            "min_price": 12.99,
            "supplier_id": supplier1.id,
            "barcode": "1234567890123",
            "reorder_level": 10,
        },
        {
            "name": "Tournevis cruciforme",
            "category": "Outil à main",
            "stock_quantity": 75,
            "min_price": 5.50,
            "supplier_id": supplier1.id,
            "barcode": "1234567890124",
            "reorder_level": 15,
        },
        {
            "name": "Clous acier (boîte 100)",
            "category": "Quincaillerie",
            "stock_quantity": 8,
            "min_price": 3.20,
            "supplier_id": supplier2.id,
            "barcode": "1234567890125",
            "reorder_level": 20,
        },
        {
            "name": "Vis inox (boîte 100)",
            "category": "Quincaillerie",
            "stock_quantity": 150,
            "min_price": 4.50,
            "supplier_id": supplier2.id,
            "barcode": "1234567890126",
            "reorder_level": 25,
        },
        {
            "name": "Scie égoïne",
            "category": "Outil à main",
            "stock_quantity": 25,
            "min_price": 18.00,
            "supplier_id": supplier1.id,
            "barcode": "1234567890127",
            "reorder_level": 8,
        },
        {
            "name": "Perceuse sans fil",
            "category": "Outil électrique",
            "stock_quantity": 15,
            "min_price": 89.99,
            "supplier_id": supplier3.id,
            "barcode": "1234567890128",
            "reorder_level": 5,
        },
    ]

    for product_data in products_data:
        if not Product.query.filter_by(name=product_data["name"]).first():
            product = Product(**product_data)
            db.session.add(product)

    # Add sample customers
    customers_data = [
        {
            "name": "Jean-Claude Convenant",
            "email": "jc.convenant@email.com",
            "phone": "06.12.34.56.78",
            "address": "123 Rue de la Paix, Paris",
        },
        {
            "name": "Sophie Bricolage",
            "email": "s.bricolage@email.com",
            "phone": "06.98.76.54.32",
            "address": "45 Avenue du Travail, Lyon",
        },
        {
            "name": "Paul Renovation",
            "email": "p.renovation@email.com",
            "phone": "06.11.22.33.44",
            "address": "78 Boulevard du Marteau, Marseille",
        },
    ]

    for customer_data in customers_data:
        if not Customer.query.filter_by(email=customer_data["email"]).first():
            customer = Customer(**customer_data)
            db.session.add(customer)

    # Add sample promotion
    if not Promotion.query.filter_by(name="Promotion Printemps").first():
        promotion = Promotion(
            name="Promotion Printemps",
            description="10% de réduction sur tous les outils à main",
            discount_percent=10.0,
            start_date=datetime.utcnow(),
            end_date=datetime.utcnow() + timedelta(days=30),
            min_quantity=1,
            applicable_categories=json.dumps(["Outil à main"]),
        )
        db.session.add(promotion)

    db.session.commit()
    print("Données d'exemple ajoutées avec succès.")


if __name__ == "__main__":
    if not os.path.exists("quincaillerie_v2.db"):
        with app.app_context():
            db.create_all()
            print("Base de données créée.")
            seed_data_command()
        app.run(debug=True)
    else:
        app.run(debug=True)
