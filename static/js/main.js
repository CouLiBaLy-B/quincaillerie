$(document).ready(function() {
    let cart = [];
    let selectedProduct = null;

    $('#product-search').on('keyup', function() {
        let query = $(this).val();
        if (query.length > 2) {
            $.ajax({
                url: '/search',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ query: query }),
                success: function(products) {
                    let results = '';
                    products.forEach(function(product) {
                        results += `<div class="search-result-item" data-id="${product.id}">${product.name} (${product.category})</div>`;
                    });
                    $('#search-results').html(results);
                }
            });
        } else {
            $('#search-results').html('');
        }
    });

    $(document).on('click', '.search-result-item', function() {
        let productId = $(this).data('id');
        $.ajax({
            url: `/product/${productId}`,
            method: 'GET',
            success: function(product) {
                selectedProduct = product;
                $('#selected-product-name').text(product.name);
                $('#selected-product-category').text(product.category);
                $('#selected-product-stock').text(product.stock_quantity);
                $('#selected-product-min-price').text(product.min_price.toFixed(2));
                $('#negotiated--price').val(product.min_price.toFixed(2));
                $('#quantity').attr('max', product.stock_quantity);
                $('#selected-product').show();
                $('#search-results').html('');
                $('#product-search').val('');
            }
        });
    });

    $('#add-to-cart').on('click', function() {
        if (!selectedProduct) return;
        let quantity = parseInt($('#quantity').val());
        let negotiatedPrice = parseFloat($('#negotiated-price').val());
        if (quantity > selectedProduct.stock_quantity) {
            alert('La quantité demandée est supérieure au stock disponible.');
            return;
        }
        if (negotiatedPrice < selectedProduct.min_price) {
            if (!confirm('Le prix de vente est inférieur au prix minimum. Continuer ?')) {
                return;
            }
        }
        let existingItem = cart.find(item => item.id === selectedProduct.id);
        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            cart.push({
                id: selectedProduct.id,
                name: selectedProduct.name,
                quantity: quantity,
                price: negotiatedPrice,
                min_price: selectedProduct.min_price
            });
        }
        updateCart();
        resetProductSelection();
    });

    function updateCart() {
        let cartItemsHtml = '';
        let total = 0;
        cart.forEach(function(item, index) {
            let itemTotal = item.quantity * item.price;
            total += itemTotal;
            cartItemsHtml += `
                <tr>
                    <td>${item.name}</td>
                    <td>${item.quantity}</td>
                    <td>${item.price.toFixed(2)} €</td>
                    <td>${itemTotal.toFixed(2)} €</td>
                    <td><button class="btn btn-danger btn-sm remove-item" data-index="${index}">X</button></td>
                </tr>
            `;
        });
        $('#cart-items').html(cartItemsHtml);
        $('#cart-total').text(total.toFixed(2));
    }

    $(document).on('click', '.remove-item', function() {
        let index = $(this).data('index');
        cart.splice(index, 1);
        updateCart();
    });

    function resetProductSelection() {
        selectedProduct = null;
        $('#selected-product').hide();
        $('#quantity').val(1);
        $('#negotiated-price').val('');
    }

    $('#finalize-sale').on('click', function() {
        if (cart.length === 0) {
            alert('Le panier est vide.');
            return;
        }
        $.ajax({
            url: '/sale',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ cart: cart }),
            success: function(response) {
                alert('Vente enregistrée avec succès !');
                cart = [];
                updateCart();
                window.open('/receipt/' + response.sale_id, '_blank');
            },
            error: function() {
                alert('Erreur lors de l\'enregistrement de la vente.');
            }
        });
    });
});