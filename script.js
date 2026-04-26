document.addEventListener('DOMContentLoaded', () => {

    /* =========================================================
       1. CONTROLO DA VISTA SECRETA (ADMIN IN JETADO)
       ========================================================= */
    const clientView = document.getElementById('client-view');
    const adminView = document.getElementById('admin-view');
    const secretAdminBtn = document.getElementById('secretAdminBtn');
    
    // Mostra o Admin e esconde o site
    window.abrirAdmin = function() {
        adminView.classList.remove('hidden');
        clientView.classList.add('hidden');
        window.scrollTo(0,0);
        
        // Atualizar Relógio e Data no Painel
        atualizarRelogioAdmin();
        if (!window.adminClockInterval) {
            window.adminClockInterval = setInterval(atualizarRelogioAdmin, 1000);
        }
    }

    function atualizarRelogioAdmin() {
        const clockEl = document.getElementById('admin-clock');
        const dateEl = document.getElementById('admin-date');
        if (!clockEl || !dateEl) return;

        const agora = new Date();
        clockEl.innerText = agora.toLocaleTimeString('pt-PT');
        dateEl.innerText = agora.toLocaleDateString('pt-PT', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    }

    // Volta ao site normal e faz logout
    window.fecharAdmin = function() {
        adminView.classList.add('hidden');
        clientView.classList.remove('hidden');
        
        // Parar Relógio
        if (window.adminClockInterval) {
            clearInterval(window.adminClockInterval);
            window.adminClockInterval = null;
        }

        // Fazer "logout" para pedir a password da próxima vez
        const loginArea = document.getElementById('loginArea');
        const dashboardArea = document.getElementById('dashboardArea');
        const inputPass = document.getElementById('password');
        
        if (loginArea && dashboardArea) {
            dashboardArea.classList.add('hidden');
            loginArea.classList.remove('hidden');
        }
        if (inputPass) {
            inputPass.value = ''; // Limpar a password que foi digitada
        }
    }

    // Se clicar no cadeado invisivel no topo direito!
    if(secretAdminBtn) {
        secretAdminBtn.addEventListener('click', abrirAdmin);
    }


    /* =========================================================
       2. LÓGICA DE AVALIAÇÃO / ADMIN / CLIENTES
       ========================================================= */
    let valorBase24k = 75.00; // default safety net
    let margemRetencao = 15.00; // default margin
    let metalSelecionado = 'ouro';
    let precoPrataBase = 0.85; 
    let margemPrata = 0.15;
    
    // Ligar ao Supabase
    const supabaseUrl = 'https://aubyexvnmuliqwkugizo.supabase.co';
    const supabaseKey = 'sb_publishable_vvgBfTseXkcYeuVCrvt5rQ_4SGBeSiO';
    const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

    // Atualizar UI Publica com valor oficial via Supabase
    async function refletirCotacaoNoSite() {
        try {
            const { data, error } = await supabase
                .from('config')
                .select('*')
                .eq('id', 1)
                .single();
                
            if (data && !error) {
                valorBase24k = data.cotacao;
                margemRetencao = data.margem;
                if (data.cotacao_prata) precoPrataBase = data.cotacao_prata;
                if (data.margem_prata) margemPrata = data.margem_prata;
            }
        } catch (error) {
            console.error("Erro a contactar o Supabase:", error);
            // Se falhar, usa os valores padrão declarados em cima
        }
        
        const monitorDisplay = document.getElementById('valor-base-display');
        if (monitorDisplay) {
            monitorDisplay.innerText = `${valorBase24k.toFixed(2)}€ / g (24k)`;
        }
        atualizarTicker();
        
        // NOVO: Carregar histórico real para o gráfico
        const seteDiasAtras = new Date();
        seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);

        const { data: historico, error: errHist } = await supabase
            .from('cotacoes_historico')
            .select('*')
            .gte('data', seteDiasAtras.toISOString())
            .order('data', { ascending: true });

        // NOVO: Carregar histórico Prata
        const { data: historicoPrata, error: errHistPrata } = await supabase
            .from('cotacoes_prata_historico')
            .select('*')
            .gte('data', seteDiasAtras.toISOString())
            .order('data', { ascending: true });

        if (historico && !errHist) {
            if (!window.myGoldChart) initChart('goldChart', historico, '#D4AF37', 'rgba(212, 175, 55, 0.05)');
            else atualizarGraficoData('goldChart', historico);
        } else if (!window.myGoldChart) {
            initChart('goldChart'); // Fallback Ouro
        }

        if (historicoPrata && !errHistPrata && historicoPrata.length > 0) {
            if (!window.mySilverChart) initChart('silverChart', historicoPrata, '#cbd5e1', 'rgba(203, 213, 225, 0.05)', precoPrataBase);
            else atualizarGraficoData('silverChart', historicoPrata);
        } else if (!window.mySilverChart) {
            initChart('silverChart', null, '#cbd5e1', 'rgba(203, 213, 225, 0.05)', precoPrataBase); // Fallback Prata
        }

        calcularSimulador(); 
    }

    // -- Ticker de Preços --
    function atualizarTicker() {
        const goldEls = document.querySelectorAll('.gold-price');
        const gold19kEls = document.querySelectorAll('.gold-price-19k');
        const silverEls = document.querySelectorAll('.silver-price');

        goldEls.forEach(el => el.innerText = `${valorBase24k.toFixed(2)}€`);
        gold19kEls.forEach(el => el.innerText = `${(valorBase24k * 0.8).toFixed(2)}€`);
        silverEls.forEach(el => el.innerText = `${precoPrataBase.toFixed(2)}€`);
    }

    // -- Gráfico de Mercado (Genérico para Ouro/Prata) --
    function initChart(canvasId, historicoData = null, color = '#D4AF37', bgColor = 'rgba(212, 175, 55, 0.05)', fallbackVal = valorBase24k) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        let labels = [];
        let dataPoints = [];

        if (historicoData && historicoData.length > 0) {
            labels = historicoData.map(item => {
                const d = new Date(item.data);
                return historicoData.length > 10 ? `${d.getDate()}/${d.getMonth() + 1}` : `${d.getDate()}/${d.getMonth() + 1} ${d.getHours()}h`;
            });
            dataPoints = historicoData.map(item => item.valor);
        } else {
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                labels.push(`${d.getDate()}/${d.getMonth() + 1}`);
                dataPoints.push(fallbackVal);
            }
        }

        const chartObj = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: canvasId === 'goldChart' ? 'Ouro 24k' : 'Prata 925',
                    data: dataPoints,
                    borderColor: color,
                    borderWidth: 3,
                    pointRadius: historicoData ? 5 : 0,
                    pointBackgroundColor: color,
                    fill: true,
                    backgroundColor: bgColor,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#141414',
                        titleColor: color,
                        bodyColor: '#fff',
                        borderColor: color,
                        borderWidth: 1
                    }
                },
                scales: {
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#94a3b8' }
                    }
                }
            }
        });

        if (canvasId === 'goldChart') window.myGoldChart = chartObj;
        else window.mySilverChart = chartObj;
    }

    function atualizarGraficoData(canvasId, historico) {
        const chartObj = (canvasId === 'goldChart') ? window.myGoldChart : window.mySilverChart;
        if (!chartObj) return;

        const labels = historico.map(item => {
            const d = new Date(item.data);
            return historico.length > 10 ? `${d.getDate()}/${d.getMonth() + 1}` : `${d.getDate()}/${d.getMonth() + 1} ${d.getHours()}h`;
        });
        const prices = historico.map(item => item.valor);
        
        chartObj.data.labels = labels;
        chartObj.data.datasets[0].data = prices;
        chartObj.data.datasets[0].pointRadius = 5;
        chartObj.update();
    }

    // -- Calculadora Cliente (UI Dinâmica) --
    const inputPeso = document.getElementById('peso');
    const inputPesoSlider = document.getElementById('pesoSlider');
    const pillBtns = document.querySelectorAll('.pill-btn');
    const outputResultado = document.getElementById('resultado-preco');
    
    let grauVar = 0.80; // Default para 19.2k (0.80 puridade)

    // Ação dos Botões de Quilates (Pills)
    function attachPillEvents() {
        const currentPills = document.querySelectorAll('#btnGroupQuilates .pill-btn');
        currentPills.forEach(btn => {
            btn.addEventListener('click', (e) => {
                currentPills.forEach(b => b.classList.remove('active'));
                const target = e.currentTarget;
                target.classList.add('active');
                grauVar = parseFloat(target.getAttribute('data-val'));
                calcularSimulador();
            });
        });
    }
    attachPillEvents();

    // Seletor de Metais
    const metalBtns = document.querySelectorAll('.metal-selector .pill-btn');
    const labelQuilates = document.getElementById('labelQuilates');
    const groupQuilates = document.getElementById('btnGroupQuilates');

    metalBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            metalBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            metalSelecionado = e.target.getAttribute('data-metal');

            // Trocar tema visual
            const simulatorSection = document.getElementById('simulacao');
            if (metalSelecionado === 'prata') {
                simulatorSection.classList.add('silver-theme');
                labelQuilates.innerText = "Pureza da Prata";
                groupQuilates.innerHTML = `
                    <button type="button" class="pill-btn active" data-val="0.925">925</button>
                    <button type="button" class="pill-btn" data-val="0.835">835</button>
                    <button type="button" class="pill-btn" data-val="0.800">800</button>
                `;
            } else {
                simulatorSection.classList.remove('silver-theme');
                labelQuilates.innerText = "Quilates (Pureza do Ouro)";
                groupQuilates.innerHTML = `
                    <button type="button" class="pill-btn" data-val="0.375">9k</button>
                    <button type="button" class="pill-btn" data-val="0.585">14k</button>
                    <button type="button" class="pill-btn" data-val="0.75">18k</button>
                    <button type="button" class="pill-btn active pt-badge" data-val="0.80">19.2k<span>Ouro Português</span></button>
                    <button type="button" class="pill-btn" data-val="1.0">24k</button>
                `;
            }
            attachPillEvents();
            grauVar = parseFloat(groupQuilates.querySelector('.active').getAttribute('data-val'));
            calcularSimulador();
        });
    });

    if (inputPeso) {
        inputPeso.addEventListener('input', calcularSimulador);
    }

    function calcularSimulador() {
        if (!inputPeso || !outputResultado) return;
        
        const pesoVar = parseFloat(inputPeso.value);

        if (isNaN(pesoVar) || pesoVar <= 0) {
            outputResultado.innerText = "0.00 €";
            return;
        }

        let precoBase = valorBase24k;
        let margem = margemRetencao;

        if (metalSelecionado === 'prata') {
            precoBase = precoPrataBase;
            margem = margemPrata;
        }

        const precoPorGramaTratado = Math.max(0, precoBase - margem);
        const valorTotalFinal = pesoVar * precoPorGramaTratado * grauVar;
        outputResultado.innerText = valorTotalFinal.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
        
        outputResultado.classList.remove('pulse-anim');
        void outputResultado.offsetWidth; 
        outputResultado.classList.add('pulse-anim');
    }
    
    refletirCotacaoNoSite(); // Corre ao iniciar!


    /* =========================================================
       3. SISTEMA DE GESTÃO (O Cérebro do Admin)
       ========================================================= */
    const inputPass = document.getElementById('password');
    const btnLogin = document.getElementById('btnLogin');
    const loginError = document.getElementById('loginError');
    const loginArea = document.getElementById('loginArea');
    const dashboardArea = document.getElementById('dashboardArea');

    if(btnLogin) {
        btnLogin.addEventListener('click', () => {
            if (inputPass.value === 'aurigold2003') {
                loginArea.classList.add('hidden');
                dashboardArea.classList.remove('hidden');
                // Mostra a cotação salva atual
                document.getElementById('newCotacao').value = valorBase24k.toFixed(2);
                document.getElementById('newMargem').value = margemRetencao.toFixed(2);
                document.getElementById('newCotacaoPrata').value = precoPrataBase.toFixed(2);
                document.getElementById('newMargemPrata').value = margemPrata.toFixed(2);
            } else {
                loginError.classList.remove('hidden');
            }
        });
    }

    const btnSaveGold = document.getElementById('btnSaveGold');
    const btnSaveSilver = document.getElementById('btnSaveSilver');

    if(btnSaveGold) {
        btnSaveGold.addEventListener('click', async () => {
            console.log("Botão Ouro Clicado");
            const numeroLimpo = document.getElementById('newCotacao').value.replace(',', '.');
            const valorCorretoNumerico = parseFloat(numeroLimpo);
            const margemLimpa = document.getElementById('newMargem').value.replace(',', '.');
            const margemNumerica = parseFloat(margemLimpa);
            
            if (!isNaN(valorCorretoNumerico) && valorCorretoNumerico > 0 && !isNaN(margemNumerica) && margemNumerica >= 0) {
                try {
                    await supabase.from('cotacoes_historico').insert([{ valor: valorCorretoNumerico }]);
                    const dataLimite = new Date();
                    dataLimite.setDate(dataLimite.getDate() - 7);
                    await supabase.from('cotacoes_historico').delete().lt('data', dataLimite.toISOString());

                    const { error } = await supabase
                        .from('config')
                        .update({ 
                            cotacao: valorCorretoNumerico, 
                            margem: margemNumerica 
                        })
                        .eq('id', 1);
                    
                    if (error) {
                        console.error(error);
                        saveMsg.innerText = "Erro ao atualizar Ouro";
                        saveMsg.classList.remove('hidden');
                        saveMsg.style.background = "#ff4d4d";
                    } else {
                        await refletirCotacaoNoSite(); 
                        saveMsg.innerText = "Ouro Atualizado com Sucesso!";
                        saveMsg.style.background = "#1da851";
                        saveMsg.classList.remove('hidden');
                        setTimeout(() => saveMsg.classList.add('hidden'), 4000);
                    }
                } catch (error) { 
                    console.error(error);
                    alert("Erro de ligação ao servidor."); 
                }
            } else {
                alert("Por favor, insira valores válidos para o Ouro.");
            }
        });
    }

    if(btnSaveSilver) {
        btnSaveSilver.addEventListener('click', async () => {
            console.log("Botão Prata Clicado");
            const cotPrataLimpa = document.getElementById('newCotacaoPrata').value.replace(',', '.');
            const cotPrataNumerica = parseFloat(cotPrataLimpa);
            const margemPrataLimpa = document.getElementById('newMargemPrata').value.replace(',', '.');
            const margemPrataNumerica = parseFloat(margemPrataLimpa);
            
            if (!isNaN(cotPrataNumerica) && cotPrataNumerica > 0 && !isNaN(margemPrataNumerica) && margemPrataNumerica >= 0) {
                try {
                    // Gravar histórico da prata
                    await supabase.from('cotacoes_prata_historico').insert([{ valor: cotPrataNumerica }]);
                    
                    // Limpar histórico prata antigo
                    const dataLimite = new Date();
                    dataLimite.setDate(dataLimite.getDate() - 7);
                    await supabase.from('cotacoes_prata_historico').delete().lt('data', dataLimite.toISOString());

                    const { error } = await supabase
                        .from('config')
                        .update({ 
                            cotacao_prata: cotPrataNumerica,
                            margem_prata: margemPrataNumerica 
                        })
                        .eq('id', 1);
                    
                    if (error) {
                        console.error(error);
                        saveMsg.innerText = "Erro ao atualizar Prata";
                        saveMsg.classList.remove('hidden');
                        saveMsg.style.background = "#ff4d4d";
                    } else {
                        await refletirCotacaoNoSite(); 
                        saveMsg.innerText = "Prata Atualizada com Sucesso!";
                        saveMsg.style.background = "#1da851";
                        saveMsg.classList.remove('hidden');
                        setTimeout(() => saveMsg.classList.add('hidden'), 4000);
                    }
                } catch (error) { 
                    console.error(error);
                    alert("Erro de ligação ao servidor."); 
                }
            } else {
                alert("Por favor, insira valores válidos para a Prata.");
            }
        });
    }

    /* =========================================================
       4. HEADER DYNAMICS
       ========================================================= */
    const header = document.getElementById('mainHeader');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 30) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });
    /* =========================================================
       5. FADE-UP SCROLL OBSERVER
       ========================================================= */
    const fadeElements = document.querySelectorAll('.fade-up-element');

    if (fadeElements.length > 0) {
        const observerOptions = {
            root: null,
            rootMargin: '0px 0px -100px 0px', // Aciona quando a linha sobe e passa nos ultimos 100px do fundo do ecrã
            threshold: 0.1
        };

        const scrollObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in-view');
                }
            });
        }, observerOptions);

        fadeElements.forEach(el => scrollObserver.observe(el));
    }

});
