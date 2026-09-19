const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
    user: null,
    page: 'caixa',
    products: [],
    categories: [],
    payments: [],
    cart: [],
    selectedCartIndex: -1,
    selectedPayment: null,
};

const pageMeta = {
    dashboard: ['Visão geral', 'Indicadores do estoque e das vendas'],
    caixa: ['Caixa', 'Registro de vendas'],
    produtos: ['Produtos', 'Cadastro e consulta do estoque'],
    movimentacoes: ['Movimentações', 'Entradas e saídas do estoque'],
    baixo: ['Estoque baixo', 'Produtos abaixo do limite mínimo'],
    relatorios: ['Relatórios', 'Consultas consolidadas do sistema'],
    funcionarios: ['Funcionários', 'Usuários e permissões'],
    pagamentos: ['Formas de pagamento', 'Configuração das formas aceitas pelo caixa'],
};

function esc(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function money(value) {
    return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function integer(value) {
    return Number(value || 0).toLocaleString('pt-BR');
}

function toast(message, type = 'success') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    $('#toast').append(el);
    setTimeout(() => el.remove(), 4000);
}

function showLogin() {
    state.user = null;
    $('#loginView').classList.remove('hidden');
    $('#appView').classList.add('hidden');
    $('#login').focus();
}

function showApp() {
    $('#loginView').classList.add('hidden');
    $('#appView').classList.remove('hidden');
    $('#userName').textContent = state.user.nome;
    $('#userRole').textContent = state.user.perfil;
    $$('.manager-only').forEach(el => el.classList.toggle('hidden', !['GERENTE', 'ADMIN'].includes(state.user.perfil)));
    $$('.admin-only').forEach(el => el.classList.toggle('hidden', state.user.perfil !== 'ADMIN'));
}

async function api(url, options = {}) {
    const opts = { ...options, credentials: 'same-origin', headers: { ...(options.headers || {}) } };
    if (opts.body !== undefined && !opts.headers['Content-Type']) opts.headers['Content-Type'] = 'application/json';
    const response = await fetch(`/api${url}`, opts);
    let data = null;
    try { data = await response.json(); } catch { data = null; }
    if (!response.ok) {
        if (response.status === 401 && state.user) showLogin();
        throw new Error(data?.error || `Erro HTTP ${response.status}`);
    }
    return data;
}

async function boot() {
    try {
        const data = await api('/auth/me');
        state.user = data.user;
        showApp();
        await loadPage('caixa');
    } catch {
        showLogin();
    }
}

async function loadPage(page) {
    if (['funcionarios', 'pagamentos'].includes(page) && !['GERENTE', 'ADMIN'].includes(state.user?.perfil)) {
        toast('Acesso restrito a gerentes e administradores.', 'error');
        return loadPage('caixa');
    }
    state.page = page;
    state.selectedCartIndex = -1;
    $$('#mainNav .nav-item').forEach(btn => btn.classList.toggle('active', btn.dataset.page === page));
    $('#pageTitle').textContent = pageMeta[page][0];
    $('#pageSubtitle').textContent = pageMeta[page][1];
    try {
        if (page === 'dashboard') return renderDashboard();
        if (page === 'caixa') return renderCaixa();
        if (page === 'produtos') return renderProdutosPage();
        if (page === 'movimentacoes') return renderMovimentacoesPage();
        if (page === 'baixo') return renderBaixoPage();
        if (page === 'relatorios') return renderRelatoriosPage();
        if (page === 'funcionarios') return renderFuncionariosPage();
        if (page === 'pagamentos') return renderPagamentosPage();
    } catch (error) {
        toast(error.message, 'error');
    }
}

async function loadProducts(query = '') {
    const suffix = query ? `?q=${encodeURIComponent(query)}` : '';
    return api(`/produtos${suffix}`);
}

async function renderDashboard() {
    const [data, sales] = await Promise.all([api('/dashboard'), api('/vendas?limit=8')]);
    $('#content').innerHTML = `
        <div class="grid stats">
            <div class="card stat"><div class="label">Produtos ativos</div><div class="value">${integer(data.produtos)}</div></div>
            <div class="card stat"><div class="label">Unidades em estoque</div><div class="value">${integer(data.unidades)}</div></div>
            <div class="card stat"><div class="label">Estoque baixo</div><div class="value">${integer(data.estoque_baixo)}</div></div>
            <div class="card stat"><div class="label">Valor do estoque</div><div class="value">${money(data.valor)}</div></div>
        </div>
        <div class="grid stats" style="margin-top:15px">
            <div class="card stat"><div class="label">Entradas hoje</div><div class="value">${integer(data.entradas_hoje)}</div></div>
            <div class="card stat"><div class="label">Saídas hoje</div><div class="value">${integer(data.saidas_hoje)}</div></div>
            <div class="card stat"><div class="label">Vendas hoje</div><div class="value">${integer(data.vendas_hoje)}</div></div>
            <div class="card stat"><div class="label">Faturamento hoje</div><div class="value">${money(data.faturamento_hoje)}</div></div>
        </div>
        <div class="card section-card" style="margin-top:15px"><div class="report-head"><h2>Últimas vendas</h2><button class="btn" id="goCash">Abrir caixa</button></div>
        <div class="table-wrap"><table class="table"><thead><tr><th>Venda</th><th>Data</th><th>Operador</th><th>Pagamento</th><th>Itens</th><th>Total</th></tr></thead><tbody>${sales.length ? sales.map(v => `<tr><td>#${String(v.id).padStart(7, '0')}</td><td>${new Date(v.finalizada_at || v.created_at).toLocaleString('pt-BR')}</td><td>${esc(v.funcionario)}</td><td>${esc(v.forma_pagamento || '-')}</td><td>${integer(v.itens)}</td><td><strong>${money(v.valor_total)}</strong></td></tr>`).join('') : '<tr><td colspan="6" class="empty">Nenhuma venda finalizada.</td></tr>'}</tbody></table></div></div>`;
    $('#goCash').onclick = () => loadPage('caixa');
}

async function renderCaixa() {
    const [products, payments] = await Promise.all([
        loadProducts(),
        state.payments.length ? Promise.resolve(state.payments) : api('/vendas/formas-pagamento'),
    ]);
    state.products = products;
    state.payments = payments;
    if (state.selectedPayment && !payments.some(p => p.id === state.selectedPayment)) state.selectedPayment = null;

    const total = state.cart.reduce((sum, item) => sum + item.quantidade * Number(item.preco), 0);
    $('#content').innerHTML = `
        <div class="pdv">
            <section class="pdv-main">
                <div class="pdv-header">
                    <div class="pdv-info"><label>Status do caixa</label><strong class="status-open">● ABERTO</strong></div>
                    <div class="pdv-info"><label>Nº da venda</label><strong>${state.cart.length ? 'NOVA VENDA' : 'NOVA VENDA'}</strong></div>
                    <div class="pdv-info"><label>Operador</label><strong>${esc(state.user.nome)}</strong></div>
                </div>
                <div class="code-box">
                    <div class="code-label"><span>Bipar / digitar código do produto</span><span>ENTER adiciona</span></div>
                    <div class="code-input-wrap"><input id="codeInput" class="code-input" autocomplete="off" inputmode="numeric" placeholder="Código do produto" aria-label="Código do produto"><span class="barcode-icon">▥</span></div>
                </div>
                <div class="operator-card"><div class="avatar orange">♙</div><div><small>Vendedor</small><strong>${esc(state.user.nome)}</strong><div class="muted" style="font-size:10px">Código: ${esc(state.user.id)}</div></div></div>
                <div class="sale-table">
                    <table class="table">
                        <thead><tr><th>Produto</th><th>Qtd.</th><th>Valor unitário</th><th>Total</th></tr></thead>
                        <tbody>${renderCartRows()}</tbody>
                    </table>
                </div>
                <div class="pdv-footer">
                    <button class="btn danger" id="removeItem">Cancelar item</button>
                    <button class="btn" id="clearSale">Limpar venda</button>
                    <span class="muted">Itens: <strong>${state.cart.length}</strong> · Qtd. total: <strong>${integer(state.cart.reduce((s, i) => s + i.quantidade, 0))}</strong></span>
                </div>
            </section>
            <aside class="pdv-side">
                <div class="total-box"><small>TOTAL DA VENDA</small><div class="total-value">${money(total)}</div></div>
                <div class="payment-title">Formas de pagamento</div>
                <div class="payment-list">${payments.map(p => `<button class="payment-btn ${state.selectedPayment === p.id ? 'selected' : ''}" data-payment="${p.id}"><span>${esc(p.nome)}</span><span>${state.selectedPayment === p.id ? '✓' : ''}</span></button>`).join('')}</div>
                <div class="shortcut-grid">
                    <div class="shortcut"><b>F2</b>Nova venda</div><div class="shortcut"><b>F3</b>Produto</div>
                    <div class="shortcut"><b>F6</b>Pagamento</div><div class="shortcut"><b>F8</b>Finalizar</div>
                </div>
                <button class="finalize" id="finalizeSale">F8 · FINALIZAR VENDA</button>
            </aside>
        </div>`;
    bindCaixa();
}

function renderCartRows() {
    if (!state.cart.length) return '<tr><td colspan="4" class="empty">Nenhum item na venda. Digite ou bipe um código para começar.</td></tr>';
    return state.cart.map((item, index) => `
        <tr data-cart-index="${index}" class="${index === state.selectedCartIndex ? 'selected-row' : ''}">
            <td><strong>${esc(item.codigo)}</strong> · ${esc(item.nome)}</td>
            <td><div class="qty-control"><button class="qty-minus" data-index="${index}" aria-label="Diminuir">−</button><span class="qty-number">${integer(item.quantidade)}</span><button class="qty-plus" data-index="${index}" aria-label="Aumentar">+</button></div></td>
            <td>${money(item.preco)}</td><td><strong>${money(item.quantidade * Number(item.preco))}</strong></td>
        </tr>`).join('');
}

function bindCaixa() {
    const code = $('#codeInput');
    code.focus();
    code.onkeydown = async event => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        const query = code.value.trim();
        if (!query) return;
        await addProductByCode(query);
        code.value = '';
    };
    $$('.payment-btn').forEach(btn => btn.onclick = () => {
        state.selectedPayment = Number(btn.dataset.payment);
        renderCaixa();
    });
    $$('.qty-minus').forEach(btn => btn.onclick = () => changeCartQuantity(Number(btn.dataset.index), -1));
    $$('.qty-plus').forEach(btn => btn.onclick = () => changeCartQuantity(Number(btn.dataset.index), 1));
    $$('[data-cart-index]').forEach(row => row.onclick = () => {
        state.selectedCartIndex = Number(row.dataset.cartIndex);
        renderCaixa();
    });
    $('#removeItem').onclick = () => {
        if (state.selectedCartIndex < 0) return toast('Selecione um item primeiro.', 'error');
        state.cart.splice(state.selectedCartIndex, 1);
        state.selectedCartIndex = -1;
        renderCaixa();
    };
    $('#clearSale').onclick = () => {
        if (!state.cart.length) return;
        if (confirm('Limpar todos os itens desta venda?')) {
            state.cart = [];
            state.selectedPayment = null;
            renderCaixa();
        }
    };
    $('#finalizeSale').onclick = finalizeSale;
}

async function addProductByCode(code) {
    try {
        const products = await loadProducts(code);
        const exact = products.find(p => String(p.codigo).toLowerCase() === code.toLowerCase());
        if (exact) return addToCart(exact);
        if (products.length === 1) return addToCart(products[0]);
        if (!products.length) return toast('Produto não encontrado.', 'error');
        openProductPicker(products);
    } catch (error) { toast(error.message, 'error'); }
}

function addToCart(product) {
    const index = state.cart.findIndex(item => item.produto_id === product.id);
    if (index >= 0) {
        if (state.cart[index].quantidade >= product.quantidade) return toast(`Estoque insuficiente. Disponível: ${product.quantidade}.`, 'error');
        state.cart[index].quantidade += 1;
        state.selectedCartIndex = index;
    } else {
        if (Number(product.quantidade) <= 0) return toast('Produto sem estoque disponível.', 'error');
        state.cart.push({ produto_id: product.id, codigo: product.codigo, nome: product.nome, preco: Number(product.preco), quantidade: 1, estoque: Number(product.quantidade) });
        state.selectedCartIndex = state.cart.length - 1;
    }
    renderCaixa();
}

function changeCartQuantity(index, delta) {
    const item = state.cart[index];
    if (!item) return;
    const next = item.quantidade + delta;
    if (next <= 0) state.cart.splice(index, 1);
    else if (next > item.estoque) return toast(`Estoque insuficiente. Disponível: ${item.estoque}.`, 'error');
    else item.quantidade = next;
    state.selectedCartIndex = Math.min(index, state.cart.length - 1);
    renderCaixa();
}

function openProductPicker(products) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `<div class="modal"><div class="modal-head"><h2>Produtos encontrados</h2><button class="close">Fechar</button></div><div class="table-wrap"><table class="table"><thead><tr><th>Código</th><th>Produto</th><th>Estoque</th><th>Preço</th><th></th></tr></thead><tbody>${products.map(p => `<tr><td>${esc(p.codigo)}</td><td>${esc(p.nome)}</td><td>${integer(p.quantidade)}</td><td>${money(p.preco)}</td><td><button class="btn choose-product" data-id="${p.id}">Adicionar</button></td></tr>`).join('')}</tbody></table></div></div>`;
    document.body.append(backdrop);
    $('.close', backdrop).onclick = () => backdrop.remove();
    $$('.choose-product', backdrop).forEach(btn => btn.onclick = () => {
        const product = products.find(p => p.id === Number(btn.dataset.id));
        if (product) addToCart(product);
        backdrop.remove();
    });
}

async function finalizeSale() {
    if (!state.cart.length) return toast('Adicione pelo menos um produto.', 'error');
    if (!state.selectedPayment) return toast('Selecione uma forma de pagamento.', 'error');
    const total = state.cart.reduce((sum, item) => sum + item.quantidade * Number(item.preco), 0);
    if (!confirm(`Finalizar venda de ${money(total)}?`)) return;
    const key = window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    try {
        const response = await api('/vendas/finalizar', {
            method: 'POST',
            headers: { 'Idempotency-Key': key },
            body: JSON.stringify({
                items: state.cart.map(item => ({ produto_id: item.produto_id, quantidade: item.quantidade })),
                forma_pagamento_id: state.selectedPayment,
            }),
        });
        toast(`Venda #${String(response.sale.id).padStart(7, '0')} finalizada.`, 'success');
        state.cart = [];
        state.selectedPayment = null;
        state.selectedCartIndex = -1;
        await renderCaixa();
    } catch (error) { toast(error.message, 'error'); }
}

async function renderProdutosPage() {
    const [products, categories] = await Promise.all([loadProducts(), api('/categorias')]);
    state.products = products; state.categories = categories;
    $('#content').innerHTML = `
        <div class="toolbar"><button class="primary" id="newProduct">+ Novo produto</button>${['GERENTE','ADMIN'].includes(state.user.perfil) ? '<button class="btn" id="manageCategories">Categorias</button>' : ''}<input id="productSearch" class="search-input" placeholder="Buscar por código ou nome"></div>
        <div id="productArea">${productTable(products)}</div>`;
    $('#newProduct').onclick = () => showProductForm();
    $('#manageCategories')?.addEventListener('click', showCategoryManager);
    $('#productSearch').oninput = async e => { const rows = await loadProducts(e.target.value); state.products = rows; $('#productArea').innerHTML = productTable(rows); bindProductTable(); };
    bindProductTable();
}

async function showCategoryManager() {
    const categories = await api('/categorias?inativos=true');
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `<div class="modal"><div class="modal-head"><h2>Categorias de produtos</h2><button class="close">Fechar</button></div>
        <form id="categoryForm" class="filters" style="margin-bottom:15px"><div class="field grow"><label>Nome<input name="nome" required maxlength="120"></label></div><div class="field grow"><label>Descrição<input name="descricao" maxlength="255"></label></div><button class="primary">Adicionar</button></form>
        <div class="table-wrap"><table class="table"><thead><tr><th>Categoria</th><th>Descrição</th><th>Produtos</th><th>Status</th><th>Ações</th></tr></thead><tbody>${categories.map(c => `<tr><td><strong>${esc(c.nome)}</strong></td><td>${esc(c.descricao || '-')}</td><td>${integer(c.produtos_count)}</td><td><span class="badge ${c.ativo ? 'ok' : 'neutral'}">${c.ativo ? 'Ativa' : 'Inativa'}</span></td><td class="actions">${c.ativo ? `<button class="btn edit-category" data-id="${c.id}">Editar</button><button class="btn danger delete-category" data-id="${c.id}" ${Number(c.produtos_count) ? 'disabled title="Reclassifique os produtos ativos antes de desativar."' : ''}>Desativar</button>` : `<button class="btn success reactivate-category" data-id="${c.id}">Reativar</button>`}</td></tr>`).join('')}</tbody></table></div></div>`;
    document.body.append(backdrop);
    $('.close', backdrop).onclick = () => backdrop.remove();
    $('#categoryForm', backdrop).onsubmit = async event => {
        event.preventDefault();
        const body = Object.fromEntries(new FormData(event.target).entries());
        try { await api('/categorias', { method: 'POST', body: JSON.stringify(body) }); toast('Categoria cadastrada.'); backdrop.remove(); await renderProdutosPage(); showCategoryManager(); } catch (e) { toast(e.message, 'error'); }
    };
    $$('.edit-category', backdrop).forEach(btn => btn.onclick = async () => {
        const category = categories.find(c => c.id === Number(btn.dataset.id));
        if (!category) return;
        const nome = prompt('Nome da categoria:', category.nome); if (nome === null) return;
        const descricao = prompt('Descrição:', category.descricao || ''); if (descricao === null) return;
        try { await api(`/categorias/${category.id}`, { method: 'PUT', body: JSON.stringify({ nome, descricao }) }); toast('Categoria atualizada.'); backdrop.remove(); await renderProdutosPage(); showCategoryManager(); } catch (e) { toast(e.message, 'error'); }
    });
    $$('.delete-category', backdrop).forEach(btn => btn.onclick = async () => {
        if (btn.disabled || !confirm('Desativar esta categoria?')) return;
        try { await api(`/categorias/${btn.dataset.id}`, { method: 'DELETE' }); toast('Categoria desativada.'); backdrop.remove(); await renderProdutosPage(); showCategoryManager(); } catch (e) { toast(e.message, 'error'); }
    });
    $$('.reactivate-category', backdrop).forEach(btn => btn.onclick = async () => {
        try { await api(`/categorias/${btn.dataset.id}/reativar`, { method: 'PATCH' }); toast('Categoria reativada.'); backdrop.remove(); await renderProdutosPage(); showCategoryManager(); } catch (e) { toast(e.message, 'error'); }
    });
}

function productTable(rows) {
    return `<div class="table-wrap"><table class="table"><thead><tr><th>Código</th><th>Produto</th><th>Categoria</th><th>Preço</th><th>Estoque</th><th>Limite</th><th>Ações</th></tr></thead><tbody>${rows.length ? rows.map(p => `<tr><td>${esc(p.codigo)}</td><td><strong>${esc(p.nome)}</strong></td><td>${esc(p.categoria)}</td><td>${money(p.preco)}</td><td><span class="badge ${Number(p.quantidade) <= Number(p.limite_minimo) ? 'danger' : 'ok'}">${integer(p.quantidade)}</span></td><td>${integer(p.limite_minimo)}</td><td class="actions"><button class="btn edit-product" data-id="${p.id}">Editar</button>${['GERENTE', 'ADMIN'].includes(state.user.perfil) ? `<button class="btn" data-limit-id="${p.id}">Limite</button>` : ''}<button class="btn danger delete-product" data-id="${p.id}">Excluir</button></td></tr>`).join('') : '<tr><td colspan="7" class="empty">Nenhum produto encontrado.</td></tr>'}</tbody></table></div>`;
}

function bindProductTable() {
    $$('.edit-product').forEach(btn => btn.onclick = async () => {
        const p = state.products.find(x => x.id === Number(btn.dataset.id)) || (await loadProducts()).find(x => x.id === Number(btn.dataset.id));
        if (p) showProductForm(p);
    });
    $$('[data-limit-id]').forEach(btn => btn.onclick = async () => {
        const p = state.products.find(x => x.id === Number(btn.dataset.limitId));
        if (!p) return;
        const value = prompt(`Limite mínimo para ${p.nome}:`, p.limite_minimo);
        if (value === null) return;
        const n = Number(value);
        if (!Number.isSafeInteger(n) || n < 0) return toast('Informe um número inteiro maior ou igual a zero.', 'error');
        try { await api(`/produtos/${p.id}/limite`, { method: 'PATCH', body: JSON.stringify({ limite_minimo: n }) }); toast('Limite mínimo atualizado.'); await renderProdutosPage(); } catch (e) { toast(e.message, 'error'); }
    });
    $$('.delete-product').forEach(btn => btn.onclick = async () => {
        if (!confirm('Excluir este produto? O histórico será preservado e o produto ficará inativo.')) return;
        try { await api(`/produtos/${btn.dataset.id}`, { method: 'DELETE' }); toast('Produto excluído.'); await renderProdutosPage(); } catch (e) { toast(e.message, 'error'); }
    });
}

function showProductForm(product = null) {
    const editing = Boolean(product);
    const limitField = ['GERENTE', 'ADMIN'].includes(state.user.perfil) ? `<div class="field"><label>Limite mínimo<input id="pLimit" type="number" min="0" step="1" value="${esc(product?.limite_minimo ?? 0)}"></label></div>` : '';
    $('#content').innerHTML = `<div class="card form-card"><div class="report-head"><h2>${editing ? 'Alterar produto' : 'Novo produto'}</h2></div><form id="productForm" class="form-grid">
        <div class="field"><label>Código<input name="codigo" required maxlength="50" value="${esc(product?.codigo ?? '')}"></label></div>
        <div class="field"><label>Nome<input name="nome" required maxlength="150" value="${esc(product?.nome ?? '')}"></label></div>
        <div class="field"><label>Categoria<select name="categoria_id" required>${state.categories.map(c => `<option value="${c.id}" ${Number(c.id) === Number(product?.categoria_id) ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select></label></div>
        <div class="field"><label>Preço<input name="preco" type="number" min="0" step="0.01" required value="${esc(product?.preco ?? '')}"></label></div>
        ${editing ? '<div class="field"><label>Estoque atual<input value="' + esc(product.quantidade) + '" disabled></label><small class="muted">Use Movimentações para alterar o estoque.</small></div>' : '<div class="field"><label>Quantidade inicial<input name="quantidade" type="number" min="0" step="1" required value="0"></label></div>'}
        ${limitField}
        <div class="form-actions full"><button class="primary">${editing ? 'Salvar alterações' : 'Cadastrar produto'}</button><button type="button" class="btn" id="cancelProduct">Cancelar</button></div>
    </form></div>`;
    $('#cancelProduct').onclick = renderProdutosPage;
    $('#productForm').onsubmit = async e => {
        e.preventDefault();
        const form = new FormData(e.target);
        const body = { codigo: form.get('codigo'), nome: form.get('nome'), categoria_id: Number(form.get('categoria_id')), preco: Number(form.get('preco')) };
        if (!editing) body.quantidade = Number(form.get('quantidade'));
        try {
            const response = await api(`/produtos${editing ? `/${product.id}` : ''}`, { method: editing ? 'PUT' : 'POST', body: JSON.stringify(body) });
            if (editing && ['GERENTE', 'ADMIN'].includes(state.user.perfil) && $('#pLimit')) {
                await api(`/produtos/${product.id}/limite`, { method: 'PATCH', body: JSON.stringify({ limite_minimo: Number($('#pLimit').value) }) });
            }
            toast(response.message || 'Produto salvo.'); await renderProdutosPage();
        } catch (error) { toast(error.message, 'error'); }
    };
}

async function renderMovimentacoesPage() {
    const products = await loadProducts();
    $('#content').innerHTML = `<div class="filters">
        <div class="field compact"><label>Produto<select id="movProduct"><option value="">Todos</option>${products.map(p => `<option value="${p.id}">${esc(p.codigo)} · ${esc(p.nome)}</option>`).join('')}</select></label></div>
        <div class="field compact"><label>Tipo<select id="movType"><option value="">Todos</option><option value="ENTRADA">Entrada</option><option value="SAIDA">Saída</option></select></label></div>
        <div class="field compact"><label>Início<input id="movStart" class="date-br" inputmode="numeric" maxlength="10" placeholder="dd/mm/aaaa" autocomplete="off"></label></div><div class="field compact"><label>Fim<input id="movEnd" class="date-br" inputmode="numeric" maxlength="10" placeholder="dd/mm/aaaa" autocomplete="off"></label></div>
        <button class="primary" id="applyMovFilters">Filtrar</button>
    </div>
    <div class="card section-card" style="margin-bottom:14px"><form id="movementForm" class="form-grid"><div class="field"><label>Produto<select name="produto_id" required>${products.map(p => `<option value="${p.id}">${esc(p.codigo)} · ${esc(p.nome)} (estoque: ${integer(p.quantidade)})</option>`).join('')}</select></label></div><div class="field"><label>Tipo<select name="tipo"><option value="ENTRADA">Entrada</option><option value="SAIDA">Saída</option></select></label></div><div class="field"><label>Quantidade<input name="quantidade" type="number" min="1" step="1" required></label></div><div class="field"><label>Observação<input name="observacao" maxlength="255"></label></div><div class="form-actions full"><button class="primary">Registrar movimentação</button></div></form></div>
    <div id="movementArea"></div>`;
    $('#movementForm').onsubmit = async e => {
        e.preventDefault(); const form = new FormData(e.target); const body = Object.fromEntries(form.entries()); body.produto_id = Number(body.produto_id); body.quantidade = Number(body.quantidade);
        try { await api('/movimentacoes', { method: 'POST', body: JSON.stringify(body) }); toast('Movimentação registrada.'); e.target.reset(); await loadMovements(); } catch (error) { toast(error.message, 'error'); }
    };
    $$('.date-br').forEach(input => input.addEventListener('input', () => formatDateBRInput(input)));
    $('#applyMovFilters').onclick = loadMovements;
    await loadMovements();
}

async function loadMovements() {
    const params = new URLSearchParams();
    const p = $('#movProduct')?.value, type = $('#movType')?.value, startBR = $('#movStart')?.value, endBR = $('#movEnd')?.value;
    const start = startBR ? dateBRToISO(startBR) : null, end = endBR ? dateBRToISO(endBR) : null;
    if (startBR && !start) return toast('Data inicial inválida. Use dd/mm/aaaa.', 'error');
    if (endBR && !end) return toast('Data final inválida. Use dd/mm/aaaa.', 'error');
    if (start) params.set('inicio', start); if (end) params.set('fim', end);
    if (p) params.set('produto_id', p); if (type) params.set('tipo', type);
    const rows = await api(`/movimentacoes${params.toString() ? `?${params}` : ''}`);
    $('#movementArea').innerHTML = `<div class="table-wrap"><table class="table"><thead><tr><th>Data</th><th>Produto</th><th>Tipo</th><th>Qtd.</th><th>Funcionário</th><th>Origem</th><th>Observação</th></tr></thead><tbody>${rows.length ? rows.map(m => `<tr><td>${new Date(m.created_at).toLocaleString('pt-BR')}</td><td>${esc(m.codigo)} · ${esc(m.produto)}</td><td><span class="badge ${m.tipo === 'ENTRADA' ? 'ok' : 'neutral'}">${m.tipo === 'ENTRADA' ? 'Entrada' : 'Saída'}</span></td><td>${integer(m.quantidade)}</td><td>${esc(m.funcionario)}</td><td>${m.venda_id ? `Venda #${String(m.venda_id).padStart(7, '0')}` : 'Manual'}</td><td>${esc(m.observacao || '-')}</td></tr>`).join('') : '<tr><td colspan="7" class="empty">Nenhuma movimentação encontrada.</td></tr>'}</tbody></table></div>`;
}

async function renderBaixoPage() {
    const rows = await api('/produtos/baixo');
    $('#content').innerHTML = `<div class="toolbar"><span class="muted">${rows.length} produto(s) precisam de reposição.</span><span class="spacer"></span><button class="btn" id="refreshLow">Atualizar</button></div><div class="low-list">${rows.length ? rows.map(p => `<div class="low-item"><div><strong>${esc(p.nome)}</strong><small>${esc(p.codigo)} · ${esc(p.categoria)} · mínimo: ${integer(p.limite_minimo)}</small></div><span class="badge danger">${integer(p.quantidade)} em estoque</span></div>`).join('') : '<div class="card empty">Nenhum produto está abaixo do limite mínimo.</div>'}</div>`;
    $('#refreshLow').onclick = renderBaixoPage;
}

function formatDateBRInput(input) {
    const digits = input.value.replace(/\D/g, '').slice(0, 8);
    const parts = [];
    if (digits.length >= 2) parts.push(digits.slice(0, 2)); else if (digits.length) parts.push(digits);
    if (digits.length >= 4) parts.push(digits.slice(2, 4)); else if (digits.length > 2) parts.push(digits.slice(2));
    if (digits.length > 4) parts.push(digits.slice(4));
    input.value = parts.join('/');
}
function dateBRToISO(value) {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
    if (!match) return null;
    const [, d, m, y] = match;
    const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    if (date.getUTCFullYear() !== Number(y) || date.getUTCMonth() !== Number(m) - 1 || date.getUTCDate() !== Number(d)) return null;
    return `${y}-${m}-${d}`;
}
function isoToBR(iso) { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; }
function setReportRange(range) {
    const now = new Date(); const end = new Date(now.getFullYear(), now.getMonth(), now.getDate()); let start = new Date(end);
    if (range === '7') start.setDate(start.getDate() - 6);
    else if (range === '30') start.setDate(start.getDate() - 29);
    else if (range === 'month') start = new Date(end.getFullYear(), end.getMonth(), 1);
    const toISO = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    $('#reportStart').value = isoToBR(toISO(start)); $('#reportEnd').value = isoToBR(toISO(end));
}
function reportSummaryCards(summary, type) {
    if (type === 'vendas') return `<div class="grid stats" style="margin-bottom:15px"><div class="card stat"><div class="label">Vendas</div><div class="value">${integer(summary.vendas)}</div></div><div class="card stat"><div class="label">Itens vendidos</div><div class="value">${integer(summary.itens)}</div></div><div class="card stat"><div class="label">Faturamento</div><div class="value">${money(summary.faturamento)}</div></div></div>`;
    if (type === 'mov') return `<div class="grid stats" style="margin-bottom:15px"><div class="card stat"><div class="label">Registros</div><div class="value">${integer(summary.registros)}</div></div><div class="card stat"><div class="label">Entradas</div><div class="value">${integer(summary.entradas)}</div></div><div class="card stat"><div class="label">Saídas</div><div class="value">${integer(summary.saidas)}</div></div></div>`;
    return `<div class="grid stats" style="margin-bottom:15px"><div class="card stat"><div class="label">Produtos</div><div class="value">${integer(summary.produtos)}</div></div><div class="card stat"><div class="label">Unidades</div><div class="value">${integer(summary.unidades)}</div></div><div class="card stat"><div class="label">Estoque baixo</div><div class="value">${integer(summary.baixo)}</div></div><div class="card stat"><div class="label">Valor do estoque</div><div class="value">${money(summary.valor)}</div></div></div>`;
}

async function renderRelatoriosPage() {
    const [categories, products, employees, payments] = await Promise.all([api('/categorias'), loadProducts(), api('/funcionarios'), api('/vendas/formas-pagamento')]);
    $('#content').innerHTML = `<div class="card report-card"><div class="report-head"><div><h2>Consultas e relatórios</h2><p class="muted">Escolha o relatório e refine os filtros. Datas sempre em dd/mm/aaaa.</p></div><button class="btn print-hide" id="printReport">Imprimir</button></div>
        <div class="report-tabs"><button class="btn active" data-report="estoque">Estoque</button><button class="btn" data-report="movimentacoes">Movimentações</button><button class="btn" data-report="vendas">Vendas</button></div>
        <div id="reportFilters"></div></div><div id="reportArea" style="margin-top:15px"></div>`;
    $('#printReport').onclick = () => window.print();
    $$('.report-tabs .btn').forEach(btn => btn.onclick = () => { $$('.report-tabs .btn').forEach(x => x.classList.toggle('active', x === btn)); renderReportFilters(btn.dataset.report, { categories, products, employees, payments }); });
    renderReportFilters('estoque', { categories, products, employees, payments });
}

function renderReportFilters(type, data) {
    if (type === 'estoque') {
        $('#reportFilters').innerHTML = `<div class="filters report-filters"><div class="field compact grow"><label>Busca<input id="reportStockQ" class="search-input" placeholder="Código ou nome"></label></div><div class="field compact"><label>Categoria<select id="reportStockCategory"><option value="">Todas</option>${data.categories.map(c => `<option value="${c.id}">${esc(c.nome)}</option>`).join('')}</select></label></div><div class="field compact"><label>Situação<select id="reportStockStatus"><option value="todos">Todos</option><option value="baixo">Estoque baixo</option><option value="normal">Acima do mínimo</option></select></label></div><button class="primary" id="stockReport">Pesquisar</button></div>`;
        $('#stockReport').onclick = async () => { try { const params = new URLSearchParams({ status: $('#reportStockStatus').value }); const q=$('#reportStockQ').value.trim(), c=$('#reportStockCategory').value; if(q)params.set('q',q); if(c)params.set('categoria_id',c); showStockReport(await api(`/relatorios/estoque?${params}`)); } catch(e){toast(e.message,'error');} };
    } else {
        $('#reportFilters').innerHTML = `<div class="filters report-filters"><div class="field compact"><label>Início<input id="reportStart" class="date-br" inputmode="numeric" maxlength="10" placeholder="dd/mm/aaaa"></label></div><div class="field compact"><label>Fim<input id="reportEnd" class="date-br" inputmode="numeric" maxlength="10" placeholder="dd/mm/aaaa"></label></div>${type==='movimentacoes' ? `<div class="field compact"><label>Produto<select id="reportMovementProduct"><option value="">Todos</option>${data.products.map(p => `<option value="${p.id}">${esc(p.codigo)} · ${esc(p.nome)}</option>`).join('')}</select></label></div><div class="field compact"><label>Tipo<select id="reportMovementType"><option value="">Todos</option><option value="ENTRADA">Entrada</option><option value="SAIDA">Saída</option></select></label></div>` : `<div class="field compact"><label>Operador<select id="reportSaleEmployee"><option value="">Todos</option>${data.employees.map(e => `<option value="${e.id}">${esc(e.nome)}</option>`).join('')}</select></label></div><div class="field compact"><label>Pagamento<select id="reportSalePayment"><option value="">Todos</option>${data.payments.map(p => `<option value="${p.id}">${esc(p.nome)}</option>`).join('')}</select></label></div><div class="field compact grow"><label>Busca<input id="reportSaleQ" class="search-input" placeholder="Nº da venda ou operador"></label></div>`}<button class="primary" id="runReport">Pesquisar</button></div><div class="quick-dates"><button class="btn" data-range="today">Hoje</button><button class="btn" data-range="7">7 dias</button><button class="btn" data-range="30">30 dias</button><button class="btn" data-range="month">Este mês</button></div>`;
        $$('.date-br').forEach(input => input.addEventListener('input', () => formatDateBRInput(input)));
        setReportRange('today');
        $$('.quick-dates .btn').forEach(btn => btn.onclick = () => setReportRange(btn.dataset.range));
        $('#runReport').onclick = async () => {
            try {
                const inicio=dateBRToISO($('#reportStart').value), fim=dateBRToISO($('#reportEnd').value); if(!inicio||!fim) throw new Error('Informe um período válido em dd/mm/aaaa.');
                if(type==='movimentacoes') { const params=new URLSearchParams({inicio,fim}); const p=$('#reportMovementProduct').value,t=$('#reportMovementType').value; if(p)params.set('produto_id',p);if(t)params.set('tipo',t); showMovementReport(await api(`/relatorios/movimentacoes?${params}`),$('#reportStart').value,$('#reportEnd').value); }
                else { const params=new URLSearchParams({inicio,fim}); const f=$('#reportSaleEmployee').value,p=$('#reportSalePayment').value,q=$('#reportSaleQ').value.trim(); if(f)params.set('funcionario_id',f);if(p)params.set('forma_pagamento_id',p);if(q)params.set('q',q); showSalesReport(await api(`/relatorios/vendas?${params}`),$('#reportStart').value,$('#reportEnd').value); }
            } catch(e){toast(e.message,'error');}
        };
    }
}

function showStockReport(result) {
    const rows=result.rows||[]; $('#reportArea').innerHTML = reportSummaryCards(result.resumo||{},'estoque') + `<div class="card report-card"><div class="report-head"><h2>Estoque</h2></div><div class="table-wrap"><table class="table"><thead><tr><th>Código</th><th>Produto</th><th>Categoria</th><th>Preço</th><th>Qtd.</th><th>Mínimo</th><th>Valor</th></tr></thead><tbody>${rows.length?rows.map(r=>`<tr><td>${esc(r.codigo)}</td><td>${esc(r.nome)}</td><td>${esc(r.categoria)}</td><td>${money(r.preco)}</td><td>${integer(r.quantidade)}</td><td>${integer(r.limite_minimo)}</td><td>${money(r.valor_estoque)}</td></tr>`).join(''):'<tr><td colspan="7" class="empty">Nenhum produto encontrado.</td></tr>'}</tbody></table></div></div>`;
}
function showMovementReport(result,start,end) {
    const rows=result.rows||[], details=result.detalhes||[]; $('#reportArea').innerHTML=reportSummaryCards(result.resumo||{},'mov')+`<div class="card report-card"><div class="report-head"><div><h2>Movimentações</h2><p class="muted">Período: ${esc(start)} a ${esc(end)} · até 1.000 registros detalhados</p></div></div><div class="table-wrap"><table class="table"><thead><tr><th>Data</th><th>Tipo</th><th>Qtd.</th><th>Produto</th><th>Funcionário</th><th>Origem</th><th>Observação</th></tr></thead><tbody>${details.length?details.map(r=>`<tr><td>${new Date(r.created_at).toLocaleString('pt-BR')}</td><td><span class="badge ${r.tipo==='ENTRADA'?'ok':'neutral'}">${r.tipo==='ENTRADA'?'Entrada':'Saída'}</span></td><td>${integer(r.quantidade)}</td><td>${esc(r.codigo)} · ${esc(r.produto)}</td><td>${esc(r.funcionario)}</td><td>${r.venda_id?`Venda #${String(r.venda_id).padStart(7,'0')}`:'Manual'}</td><td>${esc(r.observacao||'-')}</td></tr>`).join(''):'<tr><td colspan="7" class="empty">Nenhuma movimentação no período.</td></tr>'}</tbody></table></div></div>`;
}
function showSalesReport(result,start,end) {
    const rows=result.rows||[], payments=result.porPagamento||[]; $('#reportArea').innerHTML=reportSummaryCards(result.resumo||{},'vendas')+`<div class="report-grid"><div class="card report-card"><div class="report-head"><h2>Vendas por forma de pagamento</h2></div><div class="table-wrap"><table class="table"><thead><tr><th>Pagamento</th><th>Vendas</th><th>Total</th></tr></thead><tbody>${payments.length?payments.map(r=>`<tr><td>${esc(r.forma_pagamento)}</td><td>${integer(r.vendas)}</td><td>${money(r.total)}</td></tr>`).join(''):'<tr><td colspan="3" class="empty">Nenhuma venda.</td></tr>'}</tbody></table></div></div><div class="card report-card"><div class="report-head"><h2>Vendas detalhadas</h2><span class="muted">${esc(start)} a ${esc(end)}</span></div><div class="table-wrap"><table class="table"><thead><tr><th>Venda</th><th>Data</th><th>Operador</th><th>Pagamento</th><th>Itens</th><th>Total</th></tr></thead><tbody>${rows.length?rows.map(r=>`<tr><td>#${String(r.id).padStart(7,'0')}</td><td>${new Date(r.finalizada_at).toLocaleString('pt-BR')}</td><td>${esc(r.funcionario)}</td><td>${esc(r.forma_pagamento||'-')}</td><td>${integer(r.itens)}</td><td><strong>${money(r.valor_total)}</strong></td></tr>`).join(''):'<tr><td colspan="6" class="empty">Nenhuma venda encontrada.</td></tr>'}</tbody></table></div></div></div>`;
}

async function renderPagamentosPage() {
    const rows = await api('/vendas/formas-pagamento/todos');
    $('#content').innerHTML = `<div class="toolbar"><button class="primary" id="newPayment">+ Nova forma de pagamento</button><span class="muted">Formas inativas permanecem no histórico e não aparecem no caixa.</span></div><div id="paymentArea">${paymentTable(rows)}</div>`;
    $('#newPayment').onclick = () => showPaymentForm();
    bindPaymentTable();
}
function paymentTable(rows) {
    return `<div class="table-wrap"><table class="table"><thead><tr><th>Forma</th><th>Status</th><th>Vendas</th><th>Ações</th></tr></thead><tbody>${rows.map(p=>`<tr><td><strong>${esc(p.nome)}</strong></td><td><span class="badge ${p.ativo?'ok':'neutral'}">${p.ativo?'Ativa':'Inativa'}</span></td><td>${integer(p.vendas_count)}</td><td class="actions">${p.ativo?`<button class="btn edit-payment" data-id="${p.id}">Editar</button><button class="btn danger deactivate-payment" data-id="${p.id}" ${Number(p.vendas_count)?'disabled title="Possui vendas e não pode ser excluída."':''}>Desativar</button>`:`<button class="btn success reactivate-payment" data-id="${p.id}">Reativar</button>`}</td></tr>`).join('')}</tbody></table></div>`;
}
function bindPaymentTable() {
    $$('.edit-payment').forEach(btn=>btn.onclick=async()=>{const rows=await api('/vendas/formas-pagamento/todos');const p=rows.find(x=>x.id===Number(btn.dataset.id));if(p)showPaymentForm(p);});
    $$('.deactivate-payment').forEach(btn=>btn.onclick=async()=>{if(btn.disabled||!confirm('Desativar esta forma de pagamento?'))return;try{await api(`/vendas/formas-pagamento/${btn.dataset.id}`,{method:'DELETE'});toast('Forma de pagamento desativada.');await renderPagamentosPage();}catch(e){toast(e.message,'error');}});
    $$('.reactivate-payment').forEach(btn=>btn.onclick=async()=>{try{await api(`/vendas/formas-pagamento/${btn.dataset.id}/reativar`,{method:'PATCH'});toast('Forma de pagamento reativada.');await renderPagamentosPage();}catch(e){toast(e.message,'error');}});
}
function showPaymentForm(payment=null) {
    const editing=Boolean(payment); $('#content').innerHTML=`<div class="card form-card"><div class="report-head"><h2>${editing?'Alterar forma de pagamento':'Nova forma de pagamento'}</h2></div><form id="paymentForm" class="form-grid"><div class="field"><label>Nome<input name="nome" required maxlength="120" value="${esc(payment?.nome||'')}"></label></div><div class="form-actions full"><button class="primary">${editing?'Salvar alterações':'Cadastrar forma'}</button><button type="button" class="btn" id="cancelPayment">Cancelar</button></div></form></div>`;
    $('#cancelPayment').onclick=renderPagamentosPage;
    $('#paymentForm').onsubmit=async e=>{e.preventDefault();const body=Object.fromEntries(new FormData(e.target).entries());try{await api(`/vendas/formas-pagamento${editing?`/${payment.id}`:''}`,{method:editing?'PUT':'POST',body:JSON.stringify(body)});toast(editing?'Forma atualizada.':'Forma cadastrada.');await renderPagamentosPage();}catch(err){toast(err.message,'error');}};
}

async function renderFuncionariosPage() {
    const rows = await api('/funcionarios');
    $('#content').innerHTML = `<div class="toolbar"><button class="primary" id="newEmployee">+ Novo funcionário</button></div><div id="employeeArea">${employeeTable(rows)}</div>`;
    $('#newEmployee').onclick = () => showEmployeeForm();
    bindEmployeeTable();
}

function employeeTable(rows) {
    return `<div class="table-wrap"><table class="table"><thead><tr><th>Nome</th><th>Login</th><th>Perfil</th><th>Status</th><th>Vendas</th><th>Ações</th></tr></thead><tbody>${rows.map(e => {
        const canEdit = state.user.perfil === 'ADMIN' || e.perfil === 'FUNCIONARIO' || e.id === state.user.id;
        const canDelete = e.id !== state.user.id && e.perfil !== 'ADMIN' && (state.user.perfil === 'ADMIN' || e.perfil === 'FUNCIONARIO') && Number(e.vendas_count) === 0 && e.ativo;
        const deleteTitle = Number(e.vendas_count) > 0 ? 'Não pode excluir: possui vendas registradas.' : (e.id === state.user.id ? 'Você não pode excluir o próprio usuário.' : 'Excluir acesso e preservar o cadastro.');
        return `<tr><td><strong>${esc(e.nome)}</strong></td><td>${esc(e.login)}</td><td><span class="badge ${e.perfil === 'ADMIN' ? 'danger' : ''}">${esc(e.perfil)}</span></td><td><span class="badge ${e.ativo ? 'ok' : 'neutral'}">${e.ativo ? 'Ativo' : 'Inativo'}</span></td><td>${integer(e.vendas_count)}</td><td class="actions">${canEdit ? `<button class="btn edit-employee" data-id="${e.id}">Editar</button>` : '<span class="muted">Protegido</span>'}${e.ativo && e.perfil !== 'ADMIN' ? (canDelete ? `<button class="btn danger delete-employee" data-id="${e.id}">Excluir</button>` : `<button class="btn danger" disabled title="${esc(deleteTitle)}">Excluir</button>`) : ''}</td></tr>`;
    }).join('')}</tbody></table></div>`;
}
function bindEmployeeTable() {
    $$('.edit-employee').forEach(btn => btn.onclick = async () => {
        const rows = await api('/funcionarios'); const employee = rows.find(e => e.id === Number(btn.dataset.id)); if (employee) showEmployeeForm(employee);
    });
    $$('.delete-employee').forEach(btn => btn.onclick = async () => {
        if (!confirm('Excluir este funcionário? O acesso será desativado e o histórico será preservado.')) return;
        try { await api(`/funcionarios/${btn.dataset.id}`, { method: 'DELETE' }); toast('Funcionário excluído.'); await renderFuncionariosPage(); } catch (e) { toast(e.message, 'error'); }
    });
}

function showEmployeeForm(employee = null) {
    const editing = Boolean(employee);
    $('#content').innerHTML = `<div class="card form-card"><div class="report-head"><h2>${editing ? 'Alterar funcionário' : 'Novo funcionário'}</h2></div><form id="employeeForm" class="form-grid">
        <div class="field"><label>Nome<input name="nome" required maxlength="120" value="${esc(employee?.nome ?? '')}"></label></div>
        <div class="field"><label>Login<input name="login" required maxlength="60" value="${esc(employee?.login ?? '')}"></label></div>
        <div class="field"><label>${editing ? 'Nova senha (opcional)' : 'Senha'}<input name="senha" type="password" minlength="6" maxlength="200" ${editing ? '' : 'required'} autocomplete="new-password"></label></div>
        <div class="field"><label>Perfil<select name="perfil" ${editing && employee.id === state.user.id && state.user.perfil !== 'ADMIN' ? 'disabled' : ''}><option value="FUNCIONARIO" ${employee?.perfil === 'FUNCIONARIO' ? 'selected' : ''}>Funcionário</option><option value="GERENTE" ${employee?.perfil === 'GERENTE' ? 'selected' : ''}>Gerente</option>${state.user.perfil === 'ADMIN' ? `<option value="ADMIN" ${employee?.perfil === 'ADMIN' ? 'selected' : ''}>Administrador</option>` : ''}</select></label>${editing && employee.id === state.user.id && state.user.perfil !== 'ADMIN' ? '<small class="muted">Seu próprio perfil não pode ser alterado.</small>' : ''}</div>
        ${editing ? `<div class="field"><label>Status<select name="ativo" ${employee.id === state.user.id ? 'disabled' : ''}><option value="true" ${employee.ativo ? 'selected' : ''}>Ativo</option><option value="false" ${!employee.ativo ? 'selected' : ''}>Inativo</option></select></label>${employee.id === state.user.id ? '<small class="muted">Sua própria conta não pode ser desativada.</small>' : ''}</div>` : ''}
        <div class="form-actions full"><button class="primary">${editing ? 'Salvar alterações' : 'Cadastrar funcionário'}</button><button type="button" class="btn" id="cancelEmployee">Cancelar</button></div>
    </form></div>`;
    $('#cancelEmployee').onclick = renderFuncionariosPage;
    $('#employeeForm').onsubmit = async e => {
        e.preventDefault(); const form = new FormData(e.target); const body = Object.fromEntries(form.entries());
        if (editing) {
            body.ativo = employee.id === state.user.id ? true : body.ativo === 'true';
            if (!body.perfil) body.perfil = employee.perfil;
        }
        try { const response = await api(`/funcionarios${editing ? `/${employee.id}` : ''}`, { method: editing ? 'PUT' : 'POST', body: JSON.stringify(body) }); toast(response.message || 'Funcionário salvo.'); await renderFuncionariosPage(); } catch (error) { toast(error.message, 'error'); }
    };
}

$('#loginForm').onsubmit = async event => {
    event.preventDefault();
    const login = $('#login').value.trim(); const senha = $('#senha').value;
    try {
        const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ login, senha }) });
        state.user = data.user;
        $('#loginForm').reset();
        showApp();
        await loadPage('caixa');
    } catch (error) { toast(error.message, 'error'); }
};

$('#logout').onclick = async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch {}
    state.user = null; state.cart = []; state.selectedPayment = null; showLogin();
};

$('#mainNav').onclick = event => {
    const button = event.target.closest('[data-page]');
    if (button) loadPage(button.dataset.page);
};

document.addEventListener('keydown', event => {
    if (!state.user || !$('#appView') || $('#appView').classList.contains('hidden')) return;
    if (event.key === 'F2') { event.preventDefault(); if (state.page === 'caixa') { state.cart = []; state.selectedPayment = null; renderCaixa(); } else loadPage('caixa'); }
    if (event.key === 'F3') { event.preventDefault(); loadPage('caixa').then(() => $('#codeInput')?.focus()); }
    if (event.key === 'F6') { event.preventDefault(); $('#finalizeSale')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    if (event.key === 'F8') { event.preventDefault(); if (state.page === 'caixa') finalizeSale(); }
});

boot();
