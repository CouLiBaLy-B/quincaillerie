$(document).ready(function() {
    // Variables globales
    let cart = [];
    let selectedProduct = null;
    let selectedCustomer = null;
    let promotionCache = {};

    // Initialisation
    initializeApp();

    // ========== FONCTIONS D'INITIALISATION ==========
    function initializeApp() {
        loadDashboardStats();
        setupEventListeners();
        updateCartDisplay();
        loadCategories();
        setupKeyboardShortcuts();
        checkConnection();
        loadCartFromStorage();
    }

    function setupEventListeners() {
        // Recherche de produits
        $('#product-search').on('keyup', debounce(searchProducts, 300));
        
        // Recherche de clients
        $('#customer-search').on('keyup', debounce(searchCustomers, 300));
        $(document).on('click', '.customer-result-item', selectCustomer);
        $('#clear-customer').on('click', clearSelectedCustomer);

        // Gestion du panier - UTILISER LA DÉLÉGATION D'ÉVÉNEMENTS
        $(document).on('click', '#add-to-cart', addToCart);
        $(document).on('click', '.remove-item', removeFromCart);
        $(document).on('click', '.update-quantity', updateCartItemQuantity);
        $(document).on('change', '.update-quantity', updateCartItemQuantity);
        $('#clear-cart').on('click', clearCart);

        // Finalisation de la vente
        $('#finalize-sale').on('click', finalizeSale);

        // Gestion des clients
        $('#save-customer').on('click', saveNewCustomer);

        // Gestion des promotions - UTILISER LA DÉLÉGATION
        $(document).on('input', '#quantity, #negotiated-price', checkPromotions);

        // Autres événements
        $('#print-receipt').on('click', printReceipt);
        
        // Raccourcis clavier
        $(document).on('keydown', handleKeyboardShortcuts);

        // POS spécifique
        $('#pos-search').on('keyup', debounce(searchPOSProducts, 300));
        $('#category-filter').on('change', filterProductsByCategory);
        $('#pos-customer-search').on('keyup', debounce(searchPOSCustomers, 300));
        $('#pos-clear-customer').on('click', clearPOSCustomer);
        $('#pos-checkout').on('click', processPOSSale);
        $('#clear-pos-cart').on('click', clearPOSCart);
        $('#save-quick-customer').on('click', saveQuickCustomer);

        // Fermer les résultats de recherche quand on clique ailleurs
        $(document).on('click', function(e) {
            if (!$(e.target).closest('#product-search, #search-results').length) {
                $('#search-results').hide();
            }
            if (!$(e.target).closest('#customer-search, #customer-results').length) {
                $('#customer-results').hide();
            }
        });

        // Gestion des modals
        $('#productDetailModal').on('show.bs.modal', function(e) {
            const productId = $(e.relatedTarget).data('product-id');
            if (productId) {
                loadProductDetails(productId);
            }
        });

        $('#add-product-to-cart').on('click', addProductFromModal);

        // Auto-save du panier
        setInterval(saveCartToStorage, 30000); // Sauvegarde toutes les 30 secondes
    }

    // ========== FONCTIONS DE RECHERCHE ==========
    function searchProducts() {
        const query = $('#product-search').val().trim();
        
        if (query.length < 2) {
            $('#search-results').html('').hide();
            return;
        }

        // Afficher un indicateur de chargement simple
        $('#search-results').html('<div style="padding: 10px; text-align: center;"><i class="fas fa-spinner fa-spin"></i> Recherche en cours...</div>').show();

        $.ajax({
            url: '/search',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ query: query }),
            success: function(products) {
                displayProductResults(products);
            },
            error: function(xhr, status, error) {
                console.error('Erreur recherche produits:', error);
                showError('Erreur lors de la recherche de produits');
                $('#search-results').html('<div style="padding: 10px; color: #dc3545;"><i class="fas fa-exclamation-triangle"></i> Erreur de recherche</div>').show();
            }
        });
    }

    function searchPOSProducts() {
        const query = $('#pos-search').val().trim();
        const category = $('#category-filter').val();
        
        loadPOSProducts(query, category);
    }

    function loadPOSProducts(query = '', category = '') {
        const searchData = { query: query };
        if (category) {
            searchData.category = category;
        }

        $.ajax({
            url: '/search',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(searchData),
            success: function(products) {
                displayPOSProducts(products);
            },
            error: function() {
                showError('Erreur lors du chargement des produits');
            }
        });
    }

    function displayPOSProducts(products) {
        const grid = $('#products-grid');
        let html = '';

        if (products.length === 0) {
            html = '<div class="col-12 text-center text-muted py-4"><i class="fas fa-search fa-2x"></i><br>Aucun produit trouvé</div>';
        } else {
            products.forEach(function(product) {
                const stockClass = getStockStatusClass(product);
                const stockIcon = getStockStatusIcon(product);
                
                html += `
                    <div class="col-md-3 col-sm-6 mb-3">
                        <div class="product-card" data-product-id="${product.id}" onclick="selectPOSProduct(${product.id})">
                            <h6 class="mb-2">${product.name}</h6>
                            <p class="text-muted mb-2">${product.category}</p>
                            <div class="d-flex justify-content-between align-items-center">
                                <span class="font-weight-bold">${product.min_price.toFixed(2)} €</span>
                                <span class="badge ${stockClass}">
                                    ${stockIcon} ${product.stock_quantity}
                                </span>
                            </div>
                            ${product.low_stock ? '<small class="text-warning"><i class="fas fa-exclamation-triangle"></i> Stock faible</small>' : ''}
                        </div>
                    </div>
                `;
            });
        }

        grid.html(html);
    }

    function displayProductResults(products) {
        let results = '';
        
        if (products.length === 0) {
            results = '<div class="text-muted text-center" style="padding: 15px;"><i class="fas fa-search"></i><br>Aucun produit trouvé</div>';
        } else {
            products.forEach(function(product) {
                const stockClass = getStockStatusClass(product);
                const stockIcon = getStockStatusIcon(product);
                
                results += `
                    <div class="search-result-item" data-id="${product.id}" style="cursor: pointer; padding: 10px; border-bottom: 1px solid #eee; transition: background-color 0.2s;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div class="result-main">
                                <div class="result-name" style="font-weight: bold; margin-bottom: 3px;">${product.name}</div>
                                <div class="result-details" style="color: #666; font-size: 0.9em;">
                                    ${product.category} • ${product.min_price.toFixed(2)} €
                                    ${product.supplier ? ' • ' + product.supplier : ''}
                                </div>
                            </div>
                            <div class="result-badge">
                                <span class="badge ${stockClass}">
                                    ${stockIcon} ${product.stock_quantity}
                                </span>
                                ${product.low_stock ? '<br><span class="badge badge-warning" style="font-size: 0.7em;">Stock faible</span>' : ''}
                            </div>
                        </div>
                    </div>
                `;
            });
        }
        
        // Remplacer complètement le contenu (y compris le spinner de chargement)
        $('#search-results').html(results).show();
        
        // Réattacher les événements de clic
        $('.search-result-item').off('click').on('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Clic sur produit détecté, ID:', $(this).data('id'));
            selectProduct.call(this);
        });
        
        // Ajouter l'effet hover
        $('.search-result-item').hover(
            function() {
                $(this).css('background-color', '#f8f9fa');
            },
            function() {
                $(this).css('background-color', 'white');
            }
        );
    }


    function searchCustomers() {
        const query = $('#customer-search').val().trim();
        
        if (query.length < 2) {
            $('#customer-results').html('').hide();
            return;
        }

        $.ajax({
            url: '/api/customers/search',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ query: query }),
            success: function(customers) {
                displayCustomerResults(customers);
            },
            error: function() {
                showError('Erreur lors de la recherche de clients');
            }
        });
    }

    function searchPOSCustomers() {
        const query = $('#pos-customer-search').val().trim();
        
        if (query.length < 2) {
            $('#pos-customer-results').html('').hide();
            return;
        }

        $.ajax({
            url: '/api/customers/search',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ query: query }),
            success: function(customers) {
                displayPOSCustomerResults(customers);
            },
            error: function() {
                showError('Erreur lors de la recherche de clients');
            }
        });
    }

    function displayCustomerResults(customers) {
        let results = '';
        
        if (customers.length === 0) {
            results = '<div class="customer-result-item text-muted">Aucun client trouvé</div>';
        } else {
            customers.forEach(function(customer) {
                results += `
                    <div class="customer-result-item fade-in" data-id="${customer.id}">
                        <div class="result-main">
                            <div class="result-name">${customer.name}</div>
                            <div class="result-details">
                                ${customer.phone || ''} ${customer.email || ''}
                                • ${customer.total_spent.toFixed(2)} € dépensés
                            </div>
                        </div>
                        <div class="result-badge">
                            <span class="badge badge-info">${customer.visits} visites</span>
                        </div>
                    </div>
                `;
            });
        }
        
        $('#customer-results').html(results).show();
    }

    function displayPOSCustomerResults(customers) {
        let results = '';
        
        if (customers.length === 0) {
            results = '<div class="text-muted p-2">Aucun client trouvé</div>';
        } else {
            customers.forEach(function(customer) {
                results += `
                    <div class="customer-result-item p-2 border-bottom" data-id="${customer.id}" onclick="selectPOSCustomer(${customer.id}, '${customer.name}')">
                        <div class="font-weight-bold">${customer.name}</div>
                        <small class="text-muted">${customer.phone || ''} ${customer.email || ''}</small>
                    </div>
                `;
            });
        }
        
        $('#pos-customer-results').html(results).show();
    }

    // ========== SÉLECTION DE PRODUITS ET CLIENTS ==========
    function selectProduct() {
        const productId = $(this).data('id');
        
        if (!productId) {
            console.error('Aucun ID de produit trouvé');
            return;
        }
        
        console.log('Sélection du produit ID:', productId);
        
        // Afficher un indicateur de chargement spécifique pour la sélection
        $('#selected-product').html('<div class="text-center p-3"><i class="fas fa-spinner fa-spin"></i> Chargement du produit...</div>').show();

        $.ajax({
            url: `/product/${productId}`,
            method: 'GET',
            success: function(product) {
                console.log('Produit chargé:', product);
                selectedProduct = product;
                displaySelectedProduct(product);
                checkPromotions();
                $('#search-results').html('').hide();
                $('#product-search').val('');
            },
            error: function(xhr, status, error) {
                console.error('Erreur lors du chargement du produit:', error);
                showError('Erreur lors du chargement du produit');
                $('#selected-product').html('<div class="alert alert-danger">Erreur lors du chargement du produit</div>').show();
            }
        });
    }

    function selectPOSProduct(productId) {
        $.ajax({
            url: `/product/${productId}`,
            method: 'GET',
            success: function(product) {
                // Highlight selected product
                $('.product-card').removeClass('selected');
                $(`.product-card[data-product-id="${productId}"]`).addClass('selected');
                
                // Show product detail modal
                showProductDetailModal(product);
            },
            error: function() {
                showError('Erreur lors du chargement du produit');
            }
        });
    }

    function showProductDetailModal(product) {
        $('#product-detail-name').text(product.name);
        $('#product-detail-category').text(product.category);
        $('#product-detail-stock').text(product.stock_quantity);
        $('#product-detail-price').text(product.min_price.toFixed(2));
        $('#product-quantity').val(1).attr('max', product.stock_quantity);
        $('#product-unit-price').val(product.min_price.toFixed(2));
        $('#product-discount').val(0);
        
        // Store product data
        $('#productDetailModal').data('product', product);
        
        // Check for promotions
        checkProductPromotions(product.id, 1);
        
        $('#productDetailModal').modal('show');
    }

    function addProductFromModal() {
        const product = $('#productDetailModal').data('product');
        const quantity = parseInt($('#product-quantity').val());
        const price = parseFloat($('#product-unit-price').val());
        const discount = parseFloat($('#product-discount').val()) || 0;

        if (!product) {
            showError('Aucun produit sélectionné');
            return;
        }

        // Validations
        if (quantity > product.stock_quantity) {
            showError('Quantité supérieure au stock disponible');
            return;
        }

        if (price < product.min_price) {
            if (!confirm(`Prix inférieur au minimum (${product.min_price.toFixed(2)} €). Continuer ?`)) {
                return;
            }
        }

        // Add to cart
        addToPOSCart(product, quantity, price, discount);
        $('#productDetailModal').modal('hide');
    }

    function addToPOSCart(product, quantity, price, discount) {
        const existingIndex = cart.findIndex(item => item.id === product.id);
        
        if (existingIndex !== -1) {
            cart[existingIndex].quantity += quantity;
            cart[existingIndex].price = price;
            cart[existingIndex].discount_percent = discount;
        } else {
            cart.push({
                id: product.id,
                name: product.name,
                quantity: quantity,
                price: price,
                min_price: product.min_price,
                discount_percent: discount,
                category: product.category
            });
        }

        updatePOSCartDisplay();
        showSuccess('Produit ajouté au panier');
    }

    function displaySelectedProduct(product) {
        const productHtml = `
            <div class="card-body">
                <h5 class="card-title">${product.name}</h5>
                <div class="row">
                    <div class="col-md-6">
                        <p><strong>Catégorie:</strong> ${product.category}</p>
                        <p><strong>Stock disponible:</strong> <span class="badge ${getStockBadgeClass(product)}">${product.stock_quantity}</span></p>
                        <p><strong>Prix minimum:</strong> ${product.min_price.toFixed(2)} €</p>
                    </div>
                    <div class="col-md-6">
                        <div id="promotion-info" style="display: none;" class="alert alert-success">
                            <i class="fas fa-tag"></i>
                            <strong>Promotion disponible!</strong>
                            <div id="promotion-details"></div>
                        </div>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group col-md-4">
                        <label for="quantity">Quantité</label>
                        <input type="number" class="form-control" id="quantity" value="1" min="1" max="${product.stock_quantity}">
                    </div>
                    <div class="form-group col-md-4">
                        <label for="negotiated-price">Prix de vente (€)</label>
                        <input type="number" class="form-control" id="negotiated-price" step="0.01" value="${product.min_price.toFixed(2)}">
                    </div>
                    <div class="form-group col-md-4">
                        <label for="discount-percent">Remise (%)</label>
                        <input type="number" class="form-control" id="discount-percent" value="0" min="0" max="100" step="0.1">
                    </div>
                </div>
                <button id="add-to-cart" class="btn btn-primary btn-block">
                    <i class="fas fa-cart-plus"></i> Ajouter au panier
                </button>
            </div>
        `;
        
        $('#selected-product').html(productHtml).show().addClass('fade-in');
        
        // IMPORTANT: Réattacher l'événement du bouton après la création du HTML
        $('#add-to-cart').off('click').on('click', addToCart);
        
        // Réattacher les événements pour les promotions
        $('#quantity, #negotiated-price').off('input').on('input', checkPromotions);
    }

    function selectCustomer() {
        const customerId = $(this).data('id');
        const customerName = $(this).find('.result-name').text();
        
        selectedCustomer = { id: customerId, name: customerName };
        $('#selected-customer-name').text(customerName);
        $('#selected-customer').show().addClass('fade-in');
        $('#customer-results').html('').hide();
        $('#customer-search').val('');
    }

    function clearSelectedCustomer() {
        selectedCustomer = null;
        $('#selected-customer').hide();
        $('#customer-search').val('');
    }

    function selectPOSCustomer(customerId, customerName) {
        selectedCustomer = { id: customerId, name: customerName };
        $('#pos-customer-name').text(customerName);
        $('#pos-selected-customer').show();
        $('#pos-customer-results').html('').hide();
        $('#pos-customer-search').val('');
    }

    function clearSelectedCustomer() {
        selectedCustomer = null;
        $('#selected-customer').hide();
        $('#customer-search').val('');
    }

    function clearPOSCustomer() {
        selectedCustomer = null;
        $('#pos-selected-customer').hide();
        $('#pos-customer-search').val('');
    }

    // ========== GESTION DES PROMOTIONS ==========
    function checkPromotions() {
        if (!selectedProduct) return;

        const quantity = parseInt($('#quantity').val()) || 1;
        const productId = selectedProduct.id;

        checkProductPromotions(productId, quantity);
    }

    function checkProductPromotions(productId, quantity) {
        $.ajax({
            url: '/api/promotions/check',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                product_id: productId,
                quantity: quantity
            }),
            success: function(response) {
                if (response.discount_percent > 0) {
                    displayPromotionInfo(response);
                    $('#discount-percent, #product-discount').val(response.discount_percent);
                } else {
                    hidePromotionInfo();
                }
            },
            error: function() {
                hidePromotionInfo();
            }
        });
    }

    function displayPromotionInfo(promotionData) {
        const promotion = promotionData.promotion;
        const details = `
            <strong>${promotion.name}</strong><br>
            ${promotion.description}<br>
            <small>Remise: ${promotionData.discount_percent}%</small>
        `;
        
        $('#promotion-details').html(details);
        $('#promotion-info').show().addClass('fade-in');
        
        // For POS modal
        $('#product-promotion-details').html(details);
        $('#product-promotion-info').show().addClass('fade-in');
    }

    function hidePromotionInfo() {
        $('#promotion-info').hide();
        $('#product-promotion-info').hide();
    }

    // ========== GESTION DU PANIER ==========
    function addToCart() {
        console.log('Fonction addToCart appelée'); // Debug
        
        if (!selectedProduct) {
            showError('Aucun produit sélectionné');
            return;
        }

        const quantity = parseInt($('#quantity').val());
        const price = parseFloat($('#negotiated-price').val());
        const discountPercent = parseFloat($('#discount-percent').val()) || 0;

        console.log('Données du panier:', { quantity, price, discountPercent }); // Debug

        // Validations
        if (quantity > selectedProduct.stock_quantity) {
            showError('La quantité demandée est supérieure au stock disponible.');
            return;
        }

        if (price < selectedProduct.min_price) {
            if (!confirm(`Le prix de vente (${price.toFixed(2)} €) est inférieur au prix minimum (${selectedProduct.min_price.toFixed(2)} €). Continuer ?`)) {
                return;
            }
        }

        // Vérifier si le produit existe déjà dans le panier
        const existingItemIndex = cart.findIndex(item => item.id === selectedProduct.id);
        
        if (existingItemIndex !== -1) {
            // Mettre à jour l'article existant
            cart[existingItemIndex].quantity += quantity;
            cart[existingItemIndex].price = price;
            cart[existingItemIndex].discount_percent = discountPercent;
        } else {
            // Ajouter un nouvel article
            cart.push({
                id: selectedProduct.id,
                name: selectedProduct.name,
                quantity: quantity,
                price: price,
                min_price: selectedProduct.min_price,
                discount_percent: discountPercent,
                category: selectedProduct.category
            });
        }

        updateCartDisplay();
        resetProductSelection();
        showSuccess('Produit ajouté au panier');
        saveCartToStorage();
    }

    function removeFromCart() {
        const index = $(this).data('index');
        cart.splice(index, 1);
        updateCartDisplay();
        showSuccess('Produit retiré du panier');
        saveCartToStorage();
    }

    function updateCartItemQuantity() {
        const index = $(this).data('index');
        const newQuantity = parseInt($(this).val());
        
        if (newQuantity > 0) {
            cart[index].quantity = newQuantity;
            updateCartDisplay();
            saveCartToStorage();
        } else {
            cart.splice(index, 1);
            updateCartDisplay();
            saveCartToStorage();
        }
    }

    function clearCart() {
        if (cart.length === 0) return;
        
        if (confirm('Êtes-vous sûr de vouloir vider le panier ?')) {
            cart = [];
            updateCartDisplay();
            showSuccess('Panier vidé');
            saveCartToStorage();
        }
    }

    function clearPOSCart() {
        if (cart.length === 0) return;
        
        if (confirm('Êtes-vous sûr de vouloir vider le panier ?')) {
            cart = [];
            updatePOSCartDisplay();
            showSuccess('Panier vidé');
            saveCartToStorage();
        }
    }

    function updateCartDisplay() {
        let cartItemsHtml = '';
        let subtotal = 0;
        let totalDiscount = 0;

        if (cart.length === 0) {
            cartItemsHtml = `
                <tr id="empty-cart-message">
                    <td colspan="5" class="text-center text-muted">
                        <i class="fas fa-shopping-cart fa-2x"></i><br>
                        Panier vide
                    </td>
                </tr>
            `;
            $('#finalize-sale').prop('disabled', true);
        } else {
            cart.forEach(function(item, index) {
                const itemSubtotal = item.quantity * item.price;
                const itemDiscount = itemSubtotal * (item.discount_percent / 100);
                const itemTotal = itemSubtotal - itemDiscount;
                
                subtotal += itemSubtotal;
                totalDiscount += itemDiscount;

                cartItemsHtml += `
                    <tr class="cart-item-row fade-in">
                        <td>
                            <strong>${item.name}</strong>
                            ${item.discount_percent > 0 ? `<br><small class="text-success">-${item.discount_percent}%</small>` : ''}
                        </td>
                        <td>
                            <input type="number" class="form-control form-control-sm update-quantity" 
                                   value="${item.quantity}" min="1" data-index="${index}" style="width: 60px;">
                        </td>
                        <td>${item.price.toFixed(2)} €</td>
                        <td><strong>${itemTotal.toFixed(2)} €</strong></td>
                        <td>
                            <button class="btn btn-danger btn-sm remove-item" data-index="${index}">
                                <i class="fas fa-times"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });
            $('#finalize-sale').prop('disabled', false);
        }

        $('#cart-items').html(cartItemsHtml);

        // Calcul des totaux
        const finalSubtotal = subtotal - totalDiscount;
        const tax = finalSubtotal * 0.2; // TVA 20%
        const total = finalSubtotal + tax;

        $('#cart-subtotal').text(subtotal.toFixed(2));
        $('#cart-discount').text(totalDiscount.toFixed(2));
        $('#cart-tax').text(tax.toFixed(2));
        $('#cart-total').text(total.toFixed(2));
    }

    function updatePOSCartDisplay() {
        let cartHtml = '';
        let subtotal = 0;
        let totalDiscount = 0;

        if (cart.length === 0) {
            cartHtml = `
                <div class="text-center text-muted py-4">
                    <i class="fas fa-shopping-cart fa-2x"></i><br>
                    <small>Panier vide</small>
                </div>
            `;
            $('#pos-checkout').prop('disabled', true);
        } else {
            cart.forEach(function(item, index) {
                const itemSubtotal = item.quantity * item.price;
                const itemDiscount = itemSubtotal * (item.discount_percent / 100);
                const itemTotal = itemSubtotal - itemDiscount;
                
                subtotal += itemSubtotal;
                totalDiscount += itemDiscount;

                cartHtml += `
                    <div class="pos-cart-item">
                        <div class="d-flex justify-content-between align-items-start">
                            <div class="flex-grow-1">
                                <h6 class="mb-1">${item.name}</h6>
                                <small class="text-muted">${item.price.toFixed(2)} € × ${item.quantity}</small>
                                ${item.discount_percent > 0 ? `<br><small class="text-success">Remise: ${item.discount_percent}%</small>` : ''}
                            </div>
                            <div class="text-right">
                                <div class="font-weight-bold">${itemTotal.toFixed(2)} €</div>
                                <button class="btn btn-sm btn-outline-danger remove-pos-item" data-index="${index}">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });
            $('#pos-checkout').prop('disabled', false);
        }

        $('#pos-cart-items').html(cartHtml);

        // Calcul des totaux
        const finalSubtotal = subtotal - totalDiscount;
        const tax = finalSubtotal * 0.2; // TVA 20%
        const total = finalSubtotal + tax;

        $('#pos-subtotal').text(subtotal.toFixed(2));
        $('#pos-discount').text(totalDiscount.toFixed(2));
        $('#pos-tax').text(tax.toFixed(2));
        $('#pos-total').text(total.toFixed(2));

        // Event listeners for POS cart items
        $('.remove-pos-item').off('click').on('click', function() {
            const index = $(this).data('index');
            cart.splice(index, 1);
            updatePOSCartDisplay();
            showSuccess('Produit retiré du panier');
            saveCartToStorage();
        });
    }

    // ========== FINALISATION DE LA VENTE ==========
    function finalizeSale() {
        if (cart.length === 0) {
            showError('Le panier est vide.');
            return;
        }

        const saleData = {
            cart: cart,
            customer_id: selectedCustomer ? selectedCustomer.id : null,
            payment_method: $('#payment-method').val(),
            notes: $('#sale-notes').val().trim()
        };

        processSale(saleData, '#finalize-sale');
    }

    function processPOSSale() {
        if (cart.length === 0) {
            showError('Le panier est vide.');
            return;
        }

        const saleData = {
            cart: cart,
            customer_id: selectedCustomer ? selectedCustomer.id : null,
            payment_method: $('#pos-payment-method').val(),
            notes: ''
        };

        processSale(saleData, '#pos-checkout');
    }

    function processSale(saleData, buttonSelector) {
        // Désactiver le bouton pendant le traitement
        $(buttonSelector).prop('disabled', true).addClass('loading');

        $.ajax({
            url: '/sale',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(saleData),
            success: function(response) {
                handleSaleSuccess(response);
            },
            error: function(xhr) {
                handleSaleError(xhr);
            },
            complete: function() {
                $(buttonSelector).prop('disabled', false).removeClass('loading');
            }
        });
    }

    function handleSaleSuccess(response) {
        // Sauvegarder l'ID de la vente pour l'impression
        window.lastSaleId = response.sale_id;

        // Préparer le résumé de la vente
        const total = parseFloat($('#cart-total, #pos-total').text());
        const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

        $('#sale-summary').html(`
            <div class="alert alert-success">
                <h6><i class="fas fa-receipt"></i> Vente #${response.sale_id}</h6>
                <p><strong>Total:</strong> ${total.toFixed(2)} €</p>
                <p><strong>Articles:</strong> ${itemCount}</p>
                <p><strong>Client:</strong> ${selectedCustomer ? selectedCustomer.name : 'Client anonyme'}</p>
                <p><strong>Paiement:</strong> ${$('#payment-method, #pos-payment-method').val()}</p>
            </div>
        `);

        // Réinitialiser l'interface
        resetSaleInterface();

        // Afficher le modal de succès
        $('#successModal').modal('show');

        // Recharger les statistiques
        loadDashboardStats();

        showSuccess('Vente enregistrée avec succès !');
        clearStoredCart();
    }

    function handleSaleError(xhr) {
        let errorMessage = 'Erreur lors de l\'enregistrement de la vente.';
        
        if (xhr.responseJSON && xhr.responseJSON.error) {
            errorMessage = xhr.responseJSON.error;
        }
        
        showError(errorMessage);
    }

    function resetSaleInterface() {
        cart = [];
        selectedProduct = null;
        selectedCustomer = null;
        
        updateCartDisplay();
        updatePOSCartDisplay();
        resetProductSelection();
        clearSelectedCustomer();
        clearPOSCustomer();
        
        $('#payment-method, #pos-payment-method').val('Cash');
        $('#sale-notes').val('');
    }

    function printReceipt() {
        if (window.lastSaleId) {
            window.open(`/receipt/${window.lastSaleId}`, '_blank');
        }
    }

    // ========== GESTION DES CLIENTS ==========
    function saveNewCustomer() {
        const customerData = {
            name: $('#customer-name').val().trim(),
            email: $('#customer-email').val().trim(),
            phone: $('#customer-phone').val().trim(),
            address: $('#customer-address').val().trim()
        };

        if (!customerData.name) {
            showError('Le nom du client est obligatoire');
            return;
        }

        $.ajax({
            url: '/customer/add',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(customerData),
            success: function(response) {
                selectedCustomer = {
                    id: response.customer.id,
                    name: response.customer.name
                };
                
                $('#selected-customer-name').text(response.customer.name);
                $('#selected-customer').show();
                $('#addCustomerModal').modal('hide');
                
                // Réinitialiser le formulaire
                $('#add-customer-form')[0].reset();
                
                showSuccess('Client ajouté avec succès !');
            },
            error: function() {
                showError('Erreur lors de l\'ajout du client');
            }
        });
    }

    function saveQuickCustomer() {
        const customerData = {
            name: $('#quick-customer-name').val().trim(),
            phone: $('#quick-customer-phone').val().trim(),
            email: $('#quick-customer-email').val().trim()
        };

        if (!customerData.name) {
            showError('Le nom du client est obligatoire');
            return;
        }

        $.ajax({
            url: '/customer/add',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(customerData),
            success: function(response) {
                selectedCustomer = {
                    id: response.customer.id,
                    name: response.customer.name
                };
                
                $('#pos-customer-name').text(response.customer.name);
                $('#pos-selected-customer').show();
                $('#quickCustomerModal').modal('hide');
                
                // Réinitialiser le formulaire
                $('#quick-customer-form')[0].reset();
                
                showSuccess('Client ajouté avec succès !');
            },
            error: function() {
                showError('Erreur lors de l\'ajout du client');
            }
        });
    }

    // ========== FONCTIONS UTILITAIRES ==========
    function resetProductSelection() {
        selectedProduct = null;
        $('#selected-product').hide();
        $('#quantity').val(1);
        $('#negotiated-price').val('');
        $('#discount-percent').val(0);
        hidePromotionInfo();
    }

    function loadDashboardStats() {
        $.ajax({
            url: '/api/dashboard-stats',
            method: 'GET',
            success: function(stats) {
                $('#total-products').text(stats.inventory.total_products);
                $('#total-customers').text(stats.customers.total_customers);
                $('#daily-revenue').text(stats.revenue.daily.toFixed(2) + ' €');
                $('#daily-sales').text(stats.sales.daily);
                
                // Update low stock count in navbar
                if (stats.inventory.low_stock_count > 0) {
                    $('.navbar .badge').text(stats.inventory.low_stock_count).show();
                } else {
                    $('.navbar .badge').hide();
                }
            },
            error: function() {
                console.log('Erreur lors du chargement des statistiques');
            }
        });
    }

    function loadCategories() {
        // Utiliser une approche locale ou désactiver cette fonctionnalité
        console.log('Chargement des catégories désactivé temporairement');
        $('#category-filter').html('<option value="">Toutes les catégories</option>');
        
        // Ou charger les catégories via une recherche vide
        $.ajax({
            url: '/search',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ query: '' }),
            success: function(products) {
                // Extraire les catégories uniques des produits
                const categories = [...new Set(products.map(p => p.category))].filter(Boolean);
                let options = '<option value="">Toutes les catégories</option>';
                categories.forEach(function(category) {
                    options += `<option value="${category}">${category}</option>`;
                });
                $('#category-filter').html(options);
            },
            error: function(xhr, status, error) {
                console.error('Erreur lors du chargement des catégories:', error);
                $('#category-filter').html('<option value="">Toutes les catégories</option>');
            }
        });
    }

    function filterProductsByCategory() {
        const category = $('#category-filter').val();
        const query = $('#pos-search').val().trim();
        loadPOSProducts(query, category);
    }

    function getStockStatusClass(product) {
        if (product.stock_quantity <= 0) return 'badge-danger';
        if (product.stock_quantity <= product.reorder_level) return 'badge-warning';
        return 'badge-success';
    }

    function getStockBadgeClass(product) {
    if (product.stock_quantity <= 0) return 'badge-danger';
    if (product.stock_quantity <= product.reorder_level) return 'badge-warning';
    return 'badge-success';
}

    function getStockStatusIcon(product) {
        if (product.stock_quantity <= 0) return '<i class="fas fa-times"></i>';
        if (product.stock_quantity <= product.reorder_level) return '<i class="fas fa-exclamation-triangle"></i>';
        return '<i class="fas fa-check"></i>';
    }

    function getStockBadgeClass(product) {
        if (product.stock_quantity <= 0) return 'badge-danger';
        if (product.stock_quantity <= product.reorder_level) return 'badge-warning';
        return 'badge-success';
    }

    function showLoading(selector) {
        $(selector).addClass('loading').html('<div class="text-center"><i class="fas fa-spinner fa-spin"></i> Chargement...</div>');
    }

    function showSuccess(message) {
        showNotification(message, 'success');
    }

    function showError(message) {
        showNotification(message, 'error');
    }

    function showNotification(message, type) {
        const alertClass = type === 'success' ? 'alert-success' : 'alert-danger';
        const icon = type === 'success' ? 'fas fa-check-circle' : 'fas fa-exclamation-circle';
        
        const notification = $(`
            <div class="alert ${alertClass} alert-dismissible fade show notification-toast" role="alert" style="position: fixed; top: 20px; right: 20px; z-index: 9999; min-width: 300px;">
                <i class="${icon}"></i> ${message}
                <button type="button" class="close" data-dismiss="alert">
                    <span>&times;</span>
                </button>
            </div>
        `);

        // Ajouter la notification en haut de la page
        $('body').prepend(notification);

        // Supprimer automatiquement après 5 secondes
        setTimeout(() => {
            notification.alert('close');
        }, 5000);
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    function setupKeyboardShortcuts() {
        $(document).on('keydown', handleKeyboardShortcuts);
    }

    function handleKeyboardShortcuts(e) {
        // Ctrl + Enter pour finaliser la vente
        if (e.ctrlKey && e.keyCode === 13) {
            e.preventDefault();
            if (!$('#finalize-sale').prop('disabled')) {
                finalizeSale();
            } else if (!$('#pos-checkout').prop('disabled')) {
                processPOSSale();
            }
        }
        
        // Escape pour vider la sélection
        if (e.keyCode === 27) {
            $('#search-results').hide();
            $('#customer-results').hide();
            $('#pos-customer-results').hide();
            resetProductSelection();
            $('.product-card').removeClass('selected');
        }
        
        // F1 pour focus sur la recherche de produits
        if (e.keyCode === 112) {
            e.preventDefault();
            $('#product-search, #pos-search').focus();
        }
        
        // F2 pour focus sur la recherche de clients
        if (e.keyCode === 113) {
            e.preventDefault();
            $('#customer-search, #pos-customer-search').focus();
        }
        
        // F3 pour vider le panier
        if (e.keyCode === 114) {
            e.preventDefault();
            clearCart();
            clearPOSCart();
        }
    }

    // ========== SAUVEGARDE AUTOMATIQUE ==========
    function saveCartToStorage() {
        try {
            localStorage.setItem('pos_cart', JSON.stringify(cart));
            localStorage.setItem('pos_selected_customer', JSON.stringify(selectedCustomer));
            localStorage.setItem('pos_cart_timestamp', Date.now().toString());
        } catch (e) {
            console.warn('Impossible de sauvegarder le panier:', e);
        }
    }

    function loadCartFromStorage() {
        try {
            const savedCart = localStorage.getItem('pos_cart');
            const savedCustomer = localStorage.getItem('pos_selected_customer');
            const timestamp = localStorage.getItem('pos_cart_timestamp');
            
            // Vérifier si les données ne sont pas trop anciennes (24h)
            if (timestamp && (Date.now() - parseInt(timestamp)) > 24 * 60 * 60 * 1000) {
                clearStoredCart();
                return;
            }
            
            if (savedCart) {
                cart = JSON.parse(savedCart);
                updateCartDisplay();
                updatePOSCartDisplay();
                
                if (cart.length > 0) {
                    showNotification('Panier restauré depuis la dernière session', 'info');
                }
            }
            
            if (savedCustomer) {
                selectedCustomer = JSON.parse(savedCustomer);
                if (selectedCustomer) {
                    $('#selected-customer-name, #pos-customer-name').text(selectedCustomer.name);
                    $('#selected-customer, #pos-selected-customer').show();
                }
            }
        } catch (e) {
            console.warn('Erreur lors du chargement du panier sauvegardé:', e);
            clearStoredCart();
        }
    }

    function clearStoredCart() {
        localStorage.removeItem('pos_cart');
        localStorage.removeItem('pos_selected_customer');
        localStorage.removeItem('pos_cart_timestamp');
    }

    // ========== GESTION DES CODES-BARRES ==========
    $('#barcode-scan').on('click', function() {
        const barcode = prompt('Entrez le code-barres du produit:');
        if (barcode) {
            $('#product-search, #pos-search').val(barcode);
            searchProducts();
            searchPOSProducts();
        }
    });

    // Détection automatique des codes-barres
    let barcodeBuffer = '';
    let barcodeTimeout;

    $(document).on('keypress', function(e) {
        // Si le focus n'est pas sur un input, traiter comme un code-barres potentiel
        if (!$('input, textarea, select').is(':focus')) {
            clearTimeout(barcodeTimeout);
            barcodeBuffer += String.fromCharCode(e.which);
            
            barcodeTimeout = setTimeout(() => {
                if (barcodeBuffer.length > 5) { // Codes-barres généralement > 5 caractères
                    $('#product-search, #pos-search').val(barcodeBuffer);
                    searchProducts();
                    searchPOSProducts();
                }
                barcodeBuffer = '';
            }, 100);
        }
    });

    // ========== GESTION DE LA CONNEXION ==========
    function checkConnection() {
        if (!navigator.onLine) {
            showNotification('Mode hors ligne - Certaines fonctionnalités peuvent être limitées', 'warning');
        }
    }

    $(window).on('online offline', function() {
        if (navigator.onLine) {
            showNotification('Connexion rétablie', 'success');
            loadDashboardStats();
        } else {
            showNotification('Connexion perdue - Mode hors ligne', 'warning');
        }
    });

    // ========== MISE À JOUR PÉRIODIQUE ==========
    setInterval(function() {
        if (navigator.onLine) {
            loadDashboardStats();
        }
    }, 60000); // Mise à jour toutes les minutes

    // Sauvegarder le panier périodiquement
    setInterval(saveCartToStorage, 30000); // Toutes les 30 secondes

    // ========== FONCTIONS AVANCÉES ==========
    
    // Recherche universelle
    function universalSearch(query) {
        if (query.length < 2) return;

        $.ajax({
            url: '/api/search-all',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ query: query }),
            success: function(results) {
                displayUniversalResults(results);
            },
            error: function() {
                console.log('Erreur lors de la recherche universelle');
            }
        });
    }

    function displayUniversalResults(results) {
        // Afficher les résultats de recherche universelle
        // Cette fonction peut être utilisée pour une recherche globale
        console.log('Résultats de recherche:', results);
    }

    // Gestion des alertes de stock faible
    function checkLowStockAlerts() {
        $.ajax({
            url: '/api/low-stock-alerts',
            method: 'GET',
            success: function(alerts) {
                if (alerts.length > 0) {
                    displayLowStockAlerts(alerts);
                }
            },
            error: function() {
                console.log('Erreur lors de la vérification des alertes de stock');
            }
        });
    }

    function displayLowStockAlerts(alerts) {
        let alertHtml = '<div class="alert alert-warning alert-dismissible fade show" role="alert">';
        alertHtml += '<strong><i class="fas fa-exclamation-triangle"></i> Alertes de stock:</strong><br>';
        
        alerts.forEach(function(product) {
            alertHtml += `• ${product.name} (${product.current_stock} restant)<br>`;
        });
        
        alertHtml += '<button type="button" class="close" data-dismiss="alert"><span>&times;</span></button>';
        alertHtml += '</div>';
        
        $('#alerts-container').html(alertHtml);
    }

    // Vérifier les alertes au démarrage
    checkLowStockAlerts();

    // ========== FONCTIONS POUR LES RAPPORTS ==========
    function generateQuickReport() {
        const today = new Date().toISOString().split('T')[0];
        
        $.ajax({
            url: '/api/reports/sales-data',
            method: 'GET',
            data: { start_date: today, end_date: today },
            success: function(data) {
                displayQuickReport(data);
            },
            error: function() {
                showError('Erreur lors de la génération du rapport');
            }
        });
    }

    function displayQuickReport(data) {
        let reportHtml = '<div class="quick-report">';
        reportHtml += '<h6>Rapport du jour</h6>';
        
        if (data.length > 0) {
            const todayData = data[0];
            reportHtml += `<p>Ventes: ${todayData.total_sales.toFixed(2)} €</p>`;
            reportHtml += `<p>Transactions: ${todayData.transactions}</p>`;
        } else {
            reportHtml += '<p>Aucune vente aujourd\'hui</p>';
        }
        
        reportHtml += '</div>';
        
        $('#quick-report-container').html(reportHtml);
    }

    // ========== EXPORT DE DONNÉES ==========
    function exportCartData() {
        if (cart.length === 0) {
            showError('Le panier est vide');
            return;
        }

        const cartData = {
            items: cart,
            customer: selectedCustomer,
            timestamp: new Date().toISOString(),
            total: calculateCartTotal()
        };

        const dataStr = JSON.stringify(cartData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `panier_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        showSuccess('Données du panier exportées');
    }

    function calculateCartTotal() {
        let subtotal = 0;
        let totalDiscount = 0;

        cart.forEach(function(item) {
            const itemSubtotal = item.quantity * item.price;
            const itemDiscount = itemSubtotal * (item.discount_percent / 100);
            subtotal += itemSubtotal;
            totalDiscount += itemDiscount;
        });

        const finalSubtotal = subtotal - totalDiscount;
        const tax = finalSubtotal * 0.2;
        const total = finalSubtotal + tax;

        return {
            subtotal: subtotal,
            discount: totalDiscount,
            tax: tax,
            total: total
        };
    }

    // ========== GESTION DES TEMPLATES DE VENTE ==========
    function saveCartTemplate() {
        if (cart.length === 0) {
            showError('Le panier est vide');
            return;
        }

        const templateName = prompt('Nom du modèle de panier:');
        if (!templateName) return;

        const templates = JSON.parse(localStorage.getItem('cart_templates') || '{}');
        templates[templateName] = {
            items: cart,
            created: new Date().toISOString()
        };

        localStorage.setItem('cart_templates', JSON.stringify(templates));
        showSuccess('Modèle de panier sauvegardé');
        loadCartTemplates();
    }

    function loadCartTemplates() {
        const templates = JSON.parse(localStorage.getItem('cart_templates') || '{}');
        let html = '<option value="">Sélectionner un modèle</option>';

        Object.keys(templates).forEach(function(name) {
            html += `<option value="${name}">${name}</option>`;
        });

        $('#cart-templates').html(html);
    }

    function loadCartTemplate() {
        const templateName = $('#cart-templates').val();
        if (!templateName) return;

        const templates = JSON.parse(localStorage.getItem('cart_templates') || '{}');
        const template = templates[templateName];

        if (template) {
            cart = [...template.items];
            updateCartDisplay();
            updatePOSCartDisplay();
            showSuccess('Modèle de panier chargé');
        }
    }

    // ========== GESTION DES FAVORIS ==========
    function toggleProductFavorite(productId) {
        let favorites = JSON.parse(localStorage.getItem('favorite_products') || '[]');
        
        if (favorites.includes(productId)) {
            favorites = favorites.filter(id => id !== productId);
            showSuccess('Produit retiré des favoris');
        } else {
            favorites.push(productId);
            showSuccess('Produit ajouté aux favoris');
        }

        localStorage.setItem('favorite_products', JSON.stringify(favorites));
        updateFavoriteButtons();
    }

    function updateFavoriteButtons() {
        const favorites = JSON.parse(localStorage.getItem('favorite_products') || '[]');
        
        $('.favorite-btn').each(function() {
            const productId = parseInt($(this).data('product-id'));
            if (favorites.includes(productId)) {
                $(this).addClass('active').html('<i class="fas fa-heart"></i>');
            } else {
                $(this).removeClass('active').html('<i class="far fa-heart"></i>');
            }
        });
    }

    function loadFavoriteProducts() {
        const favorites = JSON.parse(localStorage.getItem('favorite_products') || '[]');
        
        if (favorites.length === 0) {
            $('#favorites-grid').html('<div class="text-center text-muted">Aucun produit favori</div>');
            return;
        }

        // Charger les détails des produits favoris
        $.ajax({
            url: '/api/products/batch',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ product_ids: favorites }),
            success: function(products) {
                displayFavoriteProducts(products);
            },
            error: function() {
                showError('Erreur lors du chargement des favoris');
            }
        });
    }

    function displayFavoriteProducts(products) {
        let html = '';
        
        products.forEach(function(product) {
            html += `
                <div class="col-md-3 col-sm-6 mb-3">
                    <div class="product-card favorite-product" data-product-id="${product.id}">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <h6 class="mb-0">${product.name}</h6>
                            <button class="btn btn-sm btn-link favorite-btn active" data-product-id="${product.id}">
                                <i class="fas fa-heart text-danger"></i>
                            </button>
                        </div>
                        <p class="text-muted mb-2">${product.category}</p>
                        <div class="d-flex justify-content-between align-items-center">
                            <span class="font-weight-bold">${product.min_price.toFixed(2)} €</span>
                            <span class="badge ${getStockStatusClass(product)}">
                                ${product.stock_quantity}
                            </span>
                        </div>
                    </div>
                </div>
            `;
        });

        $('#favorites-grid').html(html);
    }

    // ========== GESTION DES STATISTIQUES EN TEMPS RÉEL ==========
    function startRealTimeStats() {
        // Mise à jour des statistiques toutes les 30 secondes
        setInterval(function() {
            if (navigator.onLine && document.visibilityState === 'visible') {
                updateRealTimeStats();
            }
        }, 30000);
    }

    function updateRealTimeStats() {
        $.ajax({
            url: '/api/dashboard-stats',
            method: 'GET',
            success: function(stats) {
                // Mise à jour animée des statistiques
                animateStatUpdate('#total-products', stats.inventory.total_products);
                animateStatUpdate('#total-customers', stats.customers.total_customers);
                animateStatUpdate('#daily-revenue', stats.revenue.daily.toFixed(2) + ' €');
                animateStatUpdate('#daily-sales', stats.sales.daily);
            },
            error: function() {
                console.log('Erreur lors de la mise à jour des statistiques');
            }
        });
    }

    function animateStatUpdate(selector, newValue) {
        const element = $(selector);
        const currentValue = element.text();
        
        if (currentValue !== newValue.toString()) {
            element.addClass('stat-updating');
            setTimeout(() => {
                element.text(newValue).removeClass('stat-updating');
            }, 200);
        }
    }

    // ========== GESTION DES NOTIFICATIONS PUSH ==========
    function requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then(function(permission) {
                if (permission === 'granted') {
                    showSuccess('Notifications activées');
                }
            });
        }
    }

    function showDesktopNotification(title, message, icon = '/static/img/logo.png') {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, {
                body: message,
                icon: icon,
                badge: icon
            });
        }
    }

    // ========== GESTION DES ERREURS GLOBALES ==========
    window.addEventListener('error', function(e) {
        console.error('Erreur JavaScript:', e.error);
        showError('Une erreur inattendue s\'est produite');
    });

    window.addEventListener('unhandledrejection', function(e) {
        console.error('Promise rejetée:', e.reason);
        showError('Erreur de communication avec le serveur');
    });

    // ========== FONCTIONS D'ACCESSIBILITÉ ==========
    function setupAccessibility() {
        // Navigation au clavier
        $(document).on('keydown', function(e) {
            if (e.altKey && e.keyCode === 77) { // Alt + M pour le menu
                e.preventDefault();
                $('.navbar-toggler').click();
            }
        });

        // Annonces pour les lecteurs d'écran
        function announceToScreenReader(message) {
            const announcement = $('<div class="sr-only" aria-live="polite"></div>');
            announcement.text(message);
            $('body').append(announcement);
            setTimeout(() => announcement.remove(), 1000);
        }

        // Utiliser cette fonction pour les actions importantes
        window.announceToScreenReader = announceToScreenReader;
    }

    // ========== GESTION DES THÈMES ==========
    function initializeTheme() {
        const savedTheme = localStorage.getItem('pos_theme') || 'light';
        applyTheme(savedTheme);
    }

    function applyTheme(theme) {
        $('body').removeClass('theme-light theme-dark').addClass(`theme-${theme}`);
        localStorage.setItem('pos_theme', theme);
        
        // Mettre à jour le bouton de thème
        const icon = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        $('#theme-toggle i').attr('class', icon);
    }

    function toggleTheme() {
        const currentTheme = localStorage.getItem('pos_theme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        applyTheme(newTheme);
    }

    // ========== INITIALISATION FINALE ==========
    
    // Charger les modèles de panier
    loadCartTemplates();
    
    // Initialiser les favoris
    updateFavoriteButtons();
    
    // Démarrer les statistiques en temps réel
    startRealTimeStats();
    
    // Configurer l'accessibilité
    setupAccessibility();
    
    // Initialiser le thème
    initializeTheme();
    
    // Demander la permission pour les notifications
    requestNotificationPermission();

    // Event listeners supplémentaires
    $('#save-cart-template').on('click', saveCartTemplate);
    $('#load-cart-template').on('click', loadCartTemplate);
    $('#export-cart').on('click', exportCartData);
    $('#theme-toggle').on('click', toggleTheme);
    $(document).on('click', '.favorite-btn', function(e) {
        e.stopPropagation();
        const productId = parseInt($(this).data('product-id'));
        toggleProductFavorite(productId);
    });

    // Charger les produits POS au démarrage si on est sur la page POS
    if ($('#products-grid').length > 0) {
        loadPOSProducts();
    }

    // Générer un rapport rapide si on est sur le dashboard
    if ($('#quick-report-container').length > 0) {
        generateQuickReport();
    }

    // Vérification périodique de la connexion
    setInterval(function() {
        if (!navigator.onLine) {
            $('.connection-status').removeClass('d-none').addClass('d-block');
        } else {
            $('.connection-status').removeClass('d-block').addClass('d-none');
        }
    }, 5000);

    // Sauvegarde automatique avant fermeture de la page
    $(window).on('beforeunload', function() {
        if (cart.length > 0) {
            saveCartToStorage();
            return 'Vous avez des articles dans votre panier. Êtes-vous sûr de vouloir quitter ?';
        }
    });

    // Log de fin d'initialisation
    console.log('🎉 POS System fully initialized and ready!');
    console.log('📊 Features loaded:', {
        cart: cart.length > 0,
        customer: selectedCustomer !== null,
        theme: localStorage.getItem('pos_theme'),
        notifications: Notification.permission,
        online: navigator.onLine
    });

    // Afficher un message de bienvenue
    if (cart.length === 0 && !localStorage.getItem('welcome_shown')) {
        setTimeout(() => {
            showNotification('Bienvenue dans le système POS Quincaillerie !', 'info');
            localStorage.setItem('welcome_shown', 'true');
        }, 1000);
    }
});

// ========== FONCTIONS GLOBALES (accessibles depuis HTML) ==========

// Fonction globale pour sélectionner un produit POS
window.selectPOSProduct = function(productId) {
    $.ajax({
        url: `/product/${productId}`,
        method: 'GET',
        success: function(product) {
            // Highlight selected product
            $('.product-card').removeClass('selected');
            $(`.product-card[data-product-id="${productId}"]`).addClass('selected');
            
            // Show product detail modal
            $('#product-detail-name').text(product.name);
            $('#product-detail-category').text(product.category);
            $('#product-detail-stock').text(product.stock_quantity);
            $('#product-detail-price').text(product.min_price.toFixed(2));
            $('#product-quantity').val(1).attr('max', product.stock_quantity);
            $('#product-unit-price').val(product.min_price.toFixed(2));
            $('#product-discount').val(0);
            
            // Store product data
            $('#productDetailModal').data('product', product);
            
            $('#productDetailModal').modal('show');
        },
        error: function() {
            alert('Erreur lors du chargement du produit');
        }
    });
};


// Fonction globale pour sélectionner un client POS
window.selectPOSCustomer = function(customerId, customerName) {
    // Cette fonction est déjà définie dans le scope jQuery
    $('#pos-customer-name').text(customerName);
    $('#pos-selected-customer').show();
    $('#pos-customer-results').html('').hide();
    $('#pos-customer-search').val('');
    
    // Mettre à jour la variable globale
    window.selectedCustomer = { id: customerId, name: customerName };
};

// Fonction globale pour le mode plein écran
window.toggleFullscreen = function() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.log('Erreur plein écran:', err);
        });
    } else {
        document.exitFullscreen();
    }
};

// Fonction globale pour imprimer la page
window.printPage = function() {
    window.print();
};

// Fonction globale pour recharger les données
window.refreshData = function() {
    location.reload();
};


// ========== SERVICE WORKER POUR LE MODE HORS LIGNE ==========
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/static/js/sw.js')
            .then(function(registration) {
                console.log('ServiceWorker registered successfully');
            })
            .catch(function(error) {
                console.log('ServiceWorker registration failed');
            });
    });
}

// ========== GESTION DES DONNÉES HORS LIGNE ==========
function saveOfflineData(key, data) {
    try {
        const offlineData = JSON.parse(localStorage.getItem('offline_data') || '{}');
        offlineData[key] = {
            data: data,
            timestamp: Date.now()
        };
        localStorage.setItem('offline_data', JSON.stringify(offlineData));
    } catch (e) {
        console.warn('Impossible de sauvegarder les données hors ligne:', e);
    }
}

function getOfflineData(key) {
    try {
        const offlineData = JSON.parse(localStorage.getItem('offline_data') || '{}');
        return offlineData[key] ? offlineData[key].data : null;
    } catch (e) {
        console.warn('Impossible de récupérer les données hors ligne:', e);
        return null;
    }
}

// ========== SYNCHRONISATION DES DONNÉES ==========
function syncOfflineData() {
    if (!navigator.onLine) return;

    const offlineData = JSON.parse(localStorage.getItem('offline_data') || '{}');
    
    Object.keys(offlineData).forEach(function(key) {
        if (key.startsWith('pending_sale_')) {
            // Synchroniser les ventes en attente
            const saleData = offlineData[key].data;
            
            $.ajax({
                url: '/sale',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify(saleData),
                success: function(response) {
                    // Supprimer la vente en attente
                    delete offlineData[key];
                    localStorage.setItem('offline_data', JSON.stringify(offlineData));
                    
                    showNotification('Vente synchronisée avec succès', 'success');
                },
                error: function() {
                    console.log('Erreur lors de la synchronisation de la vente:', key);
                }
            });
        }
    });
}

// Synchroniser au retour en ligne
$(window).on('online', function() {
    setTimeout(syncOfflineData, 1000);
});

// ========== ANALYTICS ET MÉTRIQUES ==========
function trackEvent(category, action, label, value) {
    // Envoyer des métriques d'utilisation (si Google Analytics est configuré)
    if (typeof gtag !== 'undefined') {
        gtag('event', action, {
            event_category: category,
            event_label: label,
            value: value
        });
    }
    
    // Sauvegarder localement pour analyse
    const events = JSON.parse(localStorage.getItem('pos_events') || '[]');
    events.push({
        category: category,
        action: action,
        label: label,
        value: value,
        timestamp: Date.now()
    });
    
    // Garder seulement les 1000 derniers événements
    if (events.length > 1000) {
        events.splice(0, events.length - 1000);
    }
    
    localStorage.setItem('pos_events', JSON.stringify(events));
}

// Tracker les événements importants
$(document).on('saleCompleted', function() {
    trackEvent('Sales', 'Sale Completed', 'POS', 1);
});

$(document).on('productAdded', function() {
    trackEvent('Cart', 'Product Added', 'POS', 1);
});

// ========== FONCTIONS DE DEBUG ==========
window.POS_DEBUG = {
    getCart: function() { return cart; },
    getCustomer: function() { return selectedCustomer; },
    clearStorage: function() {
        localStorage.clear();
        console.log('Storage cleared');
    },
    exportLogs: function() {
        const logs = {
            cart: cart,
            customer: selectedCustomer,
            events: JSON.parse(localStorage.getItem('pos_events') || '[]'),
            storage: localStorage
        };
        console.log('POS Debug Data:', logs);
        return logs;
    },
    simulateOffline: function() {
        // Simuler le mode hors ligne pour les tests
        Object.defineProperty(navigator, 'onLine', {
            writable: true,
            value: false
        });
        $(window).trigger('offline');
    },
    simulateOnline: function() {
        Object.defineProperty(navigator, 'onLine', {
            writable: true,
            value: true
        });
        $(window).trigger('online');
    }
};

// ========== FINALISATION ==========
console.log('🚀 POS System JavaScript fully loaded and operational!');
console.log('💡 Use POS_DEBUG object in console for debugging');
console.log('📱 System ready for production use');

// Marquer le système comme prêt
window.POS_READY = true;
$(document).trigger('posReady');
// Fin de l'IIFE (Immediately Invoked Function Expression)
