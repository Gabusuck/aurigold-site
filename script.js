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
    }

    // Volta ao site normal e faz logout
    window.fecharAdmin = function() {
        adminView.classList.add('hidden');
        clientView.classList.remove('hidden');
        
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
            }
        } catch (error) {
            console.error("Erro a contactar o Supabase:", error);
            // Se falhar, usa os valores padrão declarados em cima
        }
        
        const monitorDisplay = document.getElementById('valor-base-display');
        if (monitorDisplay) {
            monitorDisplay.innerText = `${valorBase24k.toFixed(2)}€ / g (24k)`;
        }
        calcularSimulador(); // Recalcula com os valores oficiais reais do servidor
    }

    // -- Calculadora Cliente (UI Dinâmica) --
    const inputPeso = document.getElementById('peso');
    const inputPesoSlider = document.getElementById('pesoSlider');
    const pillBtns = document.querySelectorAll('.pill-btn');
    const outputResultado = document.getElementById('resultado-preco');
    
    let grauVar = 0.80; // Default para 19.2k (0.80 puridade)

    // Ação dos Botões de Quilates (Pills)
    pillBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            pillBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            grauVar = parseFloat(e.target.getAttribute('data-val'));
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

        // Subtraimos a margem configurável ao valor global de mercado!
        const precoPorGramaTratado = Math.max(0, valorBase24k - margemRetencao);
        const valorTotalFinal = pesoVar * precoPorGramaTratado * grauVar;
        outputResultado.innerText = valorTotalFinal.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
        
        // Ativar animação de 'salto' para feedback em tempo real
        outputResultado.classList.remove('pulse-anim');
        void outputResultado.offsetWidth; // forçar reflow para reiniciar CSS anim
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
            if (inputPass.value === 'ouro2026') {
                loginArea.classList.add('hidden');
                dashboardArea.classList.remove('hidden');
                // Mostra a cotação salva atual
                document.getElementById('newCotacao').value = valorBase24k.toFixed(2);
                document.getElementById('newMargem').value = margemRetencao.toFixed(2);
            } else {
                loginError.classList.remove('hidden');
            }
        });
    }

    const btnSave = document.getElementById('btnSave');
    const inputNovaCotacao = document.getElementById('newCotacao');
    const saveMsg = document.getElementById('saveMsg');

    if(btnSave) {
        btnSave.addEventListener('click', async () => {
            // Se escrever com vírgula de portugal (75,50), transforma em ponto (75.50) e parse!
            const numeroLimpo = inputNovaCotacao.value.replace(',', '.');
            const valorCorretoNumerico = parseFloat(numeroLimpo);
            
            const margemLimpa = document.getElementById('newMargem').value.replace(',', '.');
            const margemNumerica = parseFloat(margemLimpa);
            
            if (!isNaN(valorCorretoNumerico) && valorCorretoNumerico > 0 && !isNaN(margemNumerica) && margemNumerica >= 0) {
                
                // Validação de segurança no Frontend
                if (inputPass.value !== 'ouro2026') {
                    saveMsg.innerText = "Password incorreta!";
                    saveMsg.classList.remove('hidden');
                    saveMsg.style.color = '#ff4d4d';
                    return;
                }

                // Enviar para o Supabase
                try {
                    const { error } = await supabase
                        .from('config')
                        .update({ cotacao: valorCorretoNumerico, margem: margemNumerica })
                        .eq('id', 1);
                    
                    if (!error) {
                        // Manda o site atualizar a vista pública a fundo!
                        await refletirCotacaoNoSite(); 

                        saveMsg.innerText = "Valores Atualizados na Nuvem com Sucesso!";
                        saveMsg.classList.remove('hidden');
                        saveMsg.style.color = '#22c55e';
                        
                        alert("SUCESSO ABSOLUTO!\nA tua cotação (24k) agora é " + valorCorretoNumerico.toFixed(2) + "€ em TEMPO REAL para todo o mundo.\nO cliente verá o corte da comissão de " + margemNumerica.toFixed(2) + "€ no simulador.");
                        setTimeout(() => saveMsg.classList.add('hidden'), 5000);
                    } else {
                        saveMsg.innerText = "Erro ao gravar na Nuvem!";
                        saveMsg.classList.remove('hidden');
                        saveMsg.style.color = '#ff4d4d';
                        alert("ERRO!\n" + error.message);
                    }
                } catch (error) {
                    alert("Erro crítico ao contactar o Supabase.");
                }
            } else {
                saveMsg.innerText = "Houve um erro. Insira um número válido.";
                saveMsg.classList.remove('hidden');
                saveMsg.style.color = '#ff4d4d';
                alert("ERRO!\nFoi impossível converter os valores que submeteu num numero válido, tente outra vez.");
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
