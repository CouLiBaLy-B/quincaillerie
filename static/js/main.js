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
    }

    function setupEventListeners() {
        // Recherche de produits
        $('#product-search').on('keyup', debounce(searchProducts, 300));
        $(document).on('click', '.search-result-item', selectProduct);

        // Recherche de clients
        $('#customer-search').on('keyup', debounce(searchCustomers, 300));
        $(document).on('click', '.customer-result-item', selectCustomer);
        $('#clear-customer').on('click', clearSelectedCustomer);

        // Gestion du panier
        $('#add-to-cart').on('click', addToCart);
        $(document).on('click', '.remove-item', removeFromCart);
        $(document).on('click', '.update-quantity', updateCartItemQuantity);
        $('#clear-cart').on('click', clearCart);

        // Finalisation de la vente
        $('#finalize-sale').on('click', finalizeSale);

        // Gestion des clients
        $('#save-customer').on('click', saveNewCustomer);

        // Gestion des promotions
        $('#quantity, #negotiated-price').on('input', checkPromotions);

        // Autres événements
        $('#print-receipt').on('click', printReceipt);
        
        // Raccourcis clavier
        $(document).on('keydown', handleKeyboardShortcuts);
    }

    // ========== FONCTIONS DE RECHERCHE ==========
    function searchProducts() {
        const query = $('#product-search').val().trim();
        
        if (query.length < 2) {
            $('#search-results').html('').hide();
            return;
        }

        showLoading('#search-results');

        $.ajax({
            url: '/search',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ query: query }),
            success: function(products) {
                displayProductResults(products);
            },
            error: function() {
                showError('Erreur lors de la recherche de produits');
                $('#search-results').hide();
            }
        });
    }

    function displayProductResults(products) {
        let results = '';
        
        if (products.length === 0) {
            results = '<div class="search-result-item text-muted">Aucun produit trouvé</div>';
        } else {
            products.forEach(function(product) {
                const stockClass = getStockStatusClass(product);
                const stockIcon = getStockStatusIcon(product);
                
                results += `
                    <div class="search-result-item fade-in" data-id="${product.id}">
                        <div class="result-main">
                            <div class="result-name">${product.name}</div>
                            <div class="result-details">
                                ${product.category} • ${product.min_price.toFixed(2)} €
                                ${product.supplier ? ' • ' + product.supplier : ''}
                            </div>
                        </div>
                        <div class="result-badge">
                            <span class="badge ${stockClass}">
                                ${stockIcon} ${product.stock_quantity}
                            </span>
                            ${product.low_stock ? '<span class="badge badge-warning ml-1">Stock faible</span>' : ''}
                        </div>
                    </div>
                `;
            });
        }
        
        $('#search-results').html(results).show();
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

    // ========== SÉLECTION DE PRODUITS ET CLIENTS ==========
    function selectProduct() {
        const productId = $(this).data('id');
        showLoading('#selected-product');

        $.ajax({
            url: `/product/${productId}`,
            method: 'GET',
            success: function(product) {
                selectedProduct = product;
                displaySelectedProduct(product);
                checkPromotions();
                $('#search-results').html('').hide();
                $('#product-search').val('');
            },
            error: function() {
                showError('Erreur lors du chargement du produit');
            }
        });
    }

    function displaySelectedProduct(product) {
        $('#selected-product-name').text(product.name);
        $('#selected-product-category').text(product.category);
        $('#selected-product-stock').text(product.stock_quantity)
            .removeClass('badge-success badge-warning badge-danger')
            .addClass(getStockBadgeClass(product));
        $('#selected-product-min-price').text(product.min_price.toFixed(2));
        $('#negotiated-price').val(product.min_price.toFixed(2));
        $('#quantity').attr('max', product.stock_quantity).val(1);
        $('#discount-percent').val(0);
        
        $('#selected-product').removeClass('loading').show().addClass('fade-in');
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

    // ========== GESTION DES PROMOTIONS ==========
    function checkPromotions() {
        if (!selectedProduct) return;

        const quantity = parseInt($('#quantity').val()) || 1;
        const productId = selectedProduct.id;

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
                    $('#discount-percent').val(response.discount_percent);
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
        $('#promotion-details').html(`
            <strong>${promotion.name}</strong><br>
            ${promotion.description}<br>
            <small>Remise: ${promotionData.discount_percent}%</small>
        `);
        $('#promotion-info').show().addClass('fade-in');
    }

    function hidePromotionInfo() {
        $('#promotion-info').hide();
        // Ne pas réinitialiser automatiquement la remise
    }

    // ========== GESTION DU PANIER ==========
    function addToCart() {
        if (!selectedProduct) {
            showError('Aucun produit sélectionné');
            return;
        }

        const quantity = parseInt($('#quantity').val());
        const price = parseFloat($('#negotiated-price').val());
        const discountPercent = parseFloat($('#discount-percent').val()) || 0;

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
            cart[existingItemIndex].price = price; // Mettre à jour le prix
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
    }

    function removeFromCart() {
        const index = $(this).data('index');
        cart.splice(index, 1);
        updateCartDisplay();
        showSuccess('Produit retiré du panier');
    }

    function updateCartItemQuantity() {
        const index = $(this).data('index');
        const newQuantity = parseInt($(this).val());
        
        if (newQuantity > 0) {
            cart[index].quantity = newQuantity;
            updateCartDisplay();
        }
    }

    function clearCart() {
        if (cart.length === 0) return;
        
        if (confirm('Êtes-vous sûr de vouloir vider le panier ?')) {
            cart = [];
            updateCartDisplay();
            showSuccess('Panier vidé');
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

        // Désactiver le bouton pendant le traitement
        $('#finalize-sale').prop('disabled', true).addClass('loading');

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
                $('#finalize-sale').prop('disabled', false).removeClass('loading');
            }
        });
    }

    function handleSaleSuccess(response) {
        // Sauvegarder l'ID de la vente pour l'impression
        window.lastSaleId = response.sale_id;

        // Préparer le résumé de la vente
        const total = parseFloat($('#cart-total').text());
        const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

        $('#sale-summary').html(`
            <div class="alert alert-success">
                <h6><i class="fas fa-receipt"></i> Vente #${response.sale_id}</h6>
                <p><strong>Total:</strong> ${total.toFixed(2)} €</p>
                <p><strong>Articles:</strong> ${itemCount}</p>
                <p><strong>Client:</strong> ${selectedCustomer ? selectedCustomer.name : 'Client anonyme'}</p>
                <p><strong>Paiement:</strong> ${$('#payment-method').val()}</p>
            </div>
        `);

        // Réinitialiser l'interface
        resetSaleInterface();

        // Afficher le modal de succès
        $('#successModal').modal('show');

        // Recharger les statistiques
        loadDashboardStats();

        showSuccess('Vente enregistrée avec succès !');
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
        resetProductSelection();
        clearSelectedCustomer();
        
        $('#payment-method').val('Cash');
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
            },
            error: function() {
                console.log('Erreur lors du chargement des statistiques');
            }
        });
    }

    function getStockStatusClass(product) {
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
        $(selector).addClass('loading');
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
            <div class="alert ${alertClass} alert-dismissible fade show notification-toast" role="alert">
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

    function handleKeyboardShortcuts(e) {
        // Ctrl + Enter pour finaliser la vente
        if (e.ctrlKey && e.keyCode === 13) {
            e.preventDefault();
            if (!$('#finalize-sale').prop('disabled')) {
                finalizeSale();
            }
        }
        
        // Escape pour vider la sélection
        if (e.keyCode === 27) {
            $('#search-results').hide();
            $('#customer-results').hide();
            resetProductSelection();
        }
        
        // F1 pour focus sur la recherche de produits
        if (e.keyCode === 112) {
            e.preventDefault();
            $('#product-search').focus();
        }
        
        // F2 pour focus sur la recherche de clients
        if (e.keyCode === 113) {
            e.preventDefault();
            $('#customer-search').focus();
        }
    }

    // ========== FONCTIONS AVANCÉES ==========
    
    // Sauvegarde automatique du panier dans le localStorage
    function saveCartToStorage() {
        localStorage.setItem('pos_cart', JSON.stringify(cart));
        localStorage.setItem('pos_selected_customer', JSON.stringify(selectedCustomer));
    }

    function loadCartFromStorage() {
        const savedCart = localStorage.getItem('pos_cart');
        const savedCustomer = localStorage.getItem('pos_selected_customer');
        
        if (savedCart) {
            try {
                cart = JSON.parse(savedCart);
                updateCartDisplay();
            } catch (e) {
                console.log('Erreur lors du chargement du panier sauvegardé');
            }
        }
        
        if (savedCustomer) {
            try {
                selectedCustomer = JSON.parse(savedCustomer);
                if (selectedCustomer) {
                    $('#selected-customer-name').text(selectedCustomer.name);
                    $('#selected-customer').show();
                }
            } catch (e) {
                console.log('Erreur lors du chargement du client sauvegardé');
            }
        }
    }

    function clearStoredCart() {
        localStorage.removeItem('pos_cart');
        localStorage.removeItem('pos_selected_customer');
    }

    // Sauvegarder le panier à chaque modification
    $(document).on('cartUpdated', saveCartToStorage);

    // Charger le panier sauvegardé au démarrage
    loadCartFromStorage();

    // Vider le stockage après une vente réussie
    $(document).on('saleCompleted', clearStoredCart);

    // Déclencher l'événement de mise à jour du panier
    function triggerCartUpdate() {
        $(document).trigger('cartUpdated');
    }

    // Modifier updateCartDisplay pour déclencher l'événement
    const originalUpdateCartDisplay = updateCartDisplay;
    updateCartDisplay = function() {
        originalUpdateCartDisplay();
        triggerCartUpdate();
    };

    // Déclencher l'événement de vente terminée
    function triggerSaleCompleted() {
        $(document).trigger('saleCompleted');
    }

    // Modifier handleSaleSuccess pour déclencher l'événement
    const originalHandleSaleSuccess = handleSaleSuccess;
    handleSaleSuccess = function(response) {
        originalHandleSaleSuccess(response);
        triggerSaleCompleted();
    };

    // ========== GESTION DES CODES-BARRES ==========
    $('#barcode-scan').on('click', function() {
        const barcode = prompt('Entrez le code-barres du produit:');
        if (barcode) {
            $('#product-search').val(barcode);
            searchProducts();
        }
    });

    // Détection automatique des codes-barres (si l'utilisateur tape rapidement)
    let barcodeBuffer = '';
    let barcodeTimeout;

    $(document).on('keypress', function(e) {
        // Si le focus n'est pas sur un input, traiter comme un code-barres potentiel
        if (!$('input, textarea').is(':focus')) {
            clearTimeout(barcodeTimeout);
            barcodeBuffer += String.fromCharCode(e.which);
            
            barcodeTimeout = setTimeout(() => {
                if (barcodeBuffer.length > 5) { // Codes-barres généralement > 5 caractères
                    $('#product-search').val(barcodeBuffer);
                    searchProducts();
                }
                barcodeBuffer = '';
            }, 100);
        }
    });

    // ========== NOTIFICATIONS TOAST PERSONNALISÉES ==========
    function createToast(message, type = 'info', duration = 5000) {
        const toastId = 'toast-' + Date.now();
        const iconClass = {
            'success': 'fas fa-check-circle text-success',
            'error': 'fas fa-exclamation-circle text-danger',
            'warning': 'fas fa-exclamation-triangle text-warning',
            'info': 'fas fa-info-circle text-info'
        }[type];

        const toast = $(`
            <div id="${toastId}" class="toast notification-toast" role="alert" style="position: fixed; top: 20px; right: 20px; z-index: 9999;">
                <div class="toast-header">
                    <i class="${iconClass} mr-2"></i>
                    <strong class="mr-auto">Notification</strong>
                    <button type="button" class="ml-2 mb-1 close" data-dismiss="toast">
                        <span>&times;</span>
                    </button>
                </div>
                <div class="toast-body">
                    ${message}
                </div>
            </div>
        `);

        $('body').append(toast);
        toast.toast({ delay: duration }).toast('show');

        // Supprimer l'élément du DOM après fermeture
        toast.on('hidden.bs.toast', function() {
            $(this).remove();
        });
    }

    // Remplacer les anciennes fonctions de notification
    showSuccess = function(message) {
        createToast(message, 'success');
    };

    showError = function(message) {
        createToast(message, 'error');
    };

    // ========== MISE À JOUR PÉRIODIQUE DES STATISTIQUES ==========
    setInterval(loadDashboardStats, 30000); // Mise à jour toutes les 30 secondes

    // ========== GESTION DE LA CONNEXION ==========
    function checkConnection() {
        return navigator.onLine;
    }

    $(window).on('online offline', function() {
        if (navigator.onLine) {
            createToast('Connexion rétablie', 'success');
            loadDashboardStats();
        } else {
            createToast('Connexion perdue - Mode hors ligne', 'warning');
        }
    });

    console.log('POS System initialized successfully');
});